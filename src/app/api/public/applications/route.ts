import { createServiceClient } from "@/lib/supabase/admin";
import { loadCredential, verifySignature, verifyCaptcha, checkRateLimit } from "@/lib/public-intake/verify";
import { upsertIntake, attachResume } from "@/lib/public-intake/upsert-candidate";
import { notifyHR } from "@/lib/public-intake/notify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_RESUME_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/rtf",
  "text/plain"
]);
const ALLOWED_EXTENSIONS = /\.(pdf|doc|docx|rtf|txt)$/i;

function j(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "0.0.0.0";
}

/** Short human-readable reference: first 8 chars of the idempotency key, upper-cased. */
function toReference(idem: string): string {
  return "APP-" + idem.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Webdura-Api-Key, X-Webdura-Signature, X-Webdura-Idempotency, X-Webdura-Origin",
      "Access-Control-Max-Age": "86400"
    }
  });
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const apiKey = req.headers.get("x-webdura-api-key")?.trim() ?? "";
  const idempotencyKey = req.headers.get("x-webdura-idempotency")?.trim() ?? "";
  const signatureHeader = req.headers.get("x-webdura-signature");
  const originHeader = req.headers.get("x-webdura-origin") ?? req.headers.get("origin") ?? "";

  const respond = async (status: number, outcome: string, body: Record<string, unknown>, extra?: {
    tenantId?: string; candidateId?: string; applicationId?: string; error?: string; requestSummary?: Record<string, unknown>;
  }) => {
    try {
      await createServiceClient().from("applications_intake_log").insert({
        tenant_id: extra?.tenantId ?? null,
        api_key: apiKey || null,
        idempotency_key: idempotencyKey || null,
        ip,
        origin: originHeader || null,
        status,
        outcome,
        candidate_id: extra?.candidateId ?? null,
        application_id: extra?.applicationId ?? null,
        error: extra?.error ?? null,
        request_summary: extra?.requestSummary ?? null,
        response_summary: body
      } as never);
    } catch { /* logging must never break the response */ }
    return j(status, body);
  };

  if (!apiKey) return respond(401, "rejected", { ok: false, code: "missing_api_key", error: "X-Webdura-Api-Key header is required." });
  if (!idempotencyKey || idempotencyKey.length < 8)
    return respond(400, "rejected", { ok: false, code: "missing_idempotency", error: "X-Webdura-Idempotency header is required." });

  // Load credential (also validates that api_key is real + active)
  const cred = await loadCredential(apiKey);
  if (!cred) return respond(401, "rejected", { ok: false, code: "invalid_api_key", error: "Unknown or inactive API key." });

  // Origin allowlist (optional)
  if (cred.allowed_origins.length && !cred.allowed_origins.some((allowed) => originHeader.startsWith(allowed))) {
    return respond(403, "rejected", { ok: false, code: "origin_not_allowed", error: `Origin "${originHeader}" is not allowed.` }, { tenantId: cred.tenant_id });
  }

  // Rate limit: 5 submissions per (api_key, ip) per 10 minutes
  const allowed = await checkRateLimit(apiKey, ip, 5, 600);
  if (!allowed) return respond(429, "rejected", { ok: false, code: "rate_limited", error: "Too many submissions from this IP. Try again shortly." }, { tenantId: cred.tenant_id });

  // Idempotency replay — same key, same tenant, prior success → return the same response
  const admin = createServiceClient();
  const { data: priorLog } = await admin
    .from("applications_intake_log")
    .select("status, response_summary, candidate_id, application_id, outcome")
    .eq("tenant_id", cred.tenant_id)
    .eq("idempotency_key", idempotencyKey)
    .in("outcome", ["inserted", "duplicate"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (priorLog) {
    const prior = priorLog as { status: number; response_summary: Record<string, unknown> };
    return j(prior.status, { ...prior.response_summary, replay: true });
  }

  // Parse form
  let form: FormData;
  try { form = await req.formData(); }
  catch { return respond(400, "rejected", { ok: false, code: "bad_form", error: "Request body must be multipart/form-data." }, { tenantId: cred.tenant_id }); }

  const fullName = (form.get("full_name")?.toString() ?? "").trim();
  const email = (form.get("email")?.toString() ?? "").trim().toLowerCase();
  const phone = (form.get("phone")?.toString() ?? "").trim();
  const jobTitle = (form.get("job_title")?.toString() ?? "").trim();
  const experienceRaw = form.get("experience_years")?.toString() ?? "";
  const source = (form.get("source")?.toString() ?? "wordpress_careers").trim();
  const captchaToken = form.get("captcha_token")?.toString() ?? null;
  const honeypot = form.get("website_url")?.toString() ?? "";
  const resume = form.get("resume");

  // Honeypot
  if (honeypot.trim()) {
    return respond(400, "rejected", { ok: false, code: "spam_suspected", error: "Submission blocked." }, { tenantId: cred.tenant_id });
  }

  // Field validation
  const errors: Record<string, string> = {};
  if (!fullName) errors.full_name = "Full name is required.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.email = "Valid email is required.";
  if (!/^[+\d][\d\s\-()]{6,20}$/.test(phone)) errors.phone = "Valid phone number is required.";
  if (!jobTitle) errors.job_title = "Job title is required.";
  const experienceYears = Number(experienceRaw);
  if (!Number.isFinite(experienceYears) || experienceYears < 0 || experienceYears > 60) {
    errors.experience_years = "Experience must be a number between 0 and 60.";
  }
  if (!(resume instanceof File)) errors.resume = "Resume file is required.";
  else {
    if (resume.size <= 0) errors.resume = "Resume file is empty.";
    else if (resume.size > MAX_RESUME_BYTES) errors.resume = `Resume must be ≤ ${MAX_RESUME_BYTES / (1024 * 1024)} MB.`;
    else if (!(ALLOWED_MIMES.has(resume.type) || ALLOWED_EXTENSIONS.test(resume.name))) {
      errors.resume = "Resume must be a PDF, DOC, DOCX, RTF, or TXT.";
    }
  }
  if (Object.keys(errors).length) {
    return respond(400, "rejected", { ok: false, code: "validation_failed", error: "One or more fields are invalid.", fields: errors }, { tenantId: cred.tenant_id });
  }

  // Signature verification (canonical string binds the important fields to the signature)
  const sig = verifySignature({
    header: signatureHeader, secret: cred.api_secret, apiKey, idempotencyKey, email, jobTitle
  });
  if (!sig.ok) return respond(401, "rejected", { ok: false, code: "bad_signature", error: sig.error }, { tenantId: cred.tenant_id });

  // Captcha
  const captcha = await verifyCaptcha(captchaToken, ip);
  if (!captcha.ok) return respond(403, "rejected", { ok: false, code: "captcha_failed", error: captcha.error }, { tenantId: cred.tenant_id });

  // Name split — no middle name field on the WP form; assume first token = first name, remainder = last
  const parts = fullName.split(/\s+/);
  const firstName = parts.shift() ?? fullName;
  const lastName = parts.length ? parts.join(" ") : null;

  const reqSummary = { email, job_title: jobTitle, phone, experience_years: experienceYears, has_resume: true, source };

  // Upsert candidate + application
  const intake = await upsertIntake({
    tenant_id: cred.tenant_id,
    first_name: firstName,
    last_name: lastName,
    email,
    phone,
    experience_years: experienceYears,
    job_title: jobTitle,
    default_job_id: cred.default_job_id,
    source
  });

  if (intake.outcome === "rejected" || !intake.candidate_id) {
    return respond(422, "rejected", { ok: false, code: "intake_failed", error: intake.error ?? "Could not create application." }, {
      tenantId: cred.tenant_id, error: intake.error, requestSummary: reqSummary
    });
  }

  // Attach resume (skip if duplicate + resume already on file)
  let resumeUploaded = false;
  if (resume instanceof File) {
    if (intake.outcome === "duplicate") {
      const { data: existing } = await admin
        .from("documents").select("id")
        .eq("candidate_id", intake.candidate_id).eq("kind", "resume").limit(1).maybeSingle();
      if (!existing) {
        const up = await attachResume({ tenant_id: cred.tenant_id, candidate_id: intake.candidate_id, file: resume });
        resumeUploaded = up.ok;
      }
    } else {
      const up = await attachResume({ tenant_id: cred.tenant_id, candidate_id: intake.candidate_id, file: resume });
      resumeUploaded = up.ok;
    }
  }

  const reference = toReference(idempotencyKey);

  // Fire-and-forget notification (only for genuinely new applications)
  if (intake.outcome === "inserted") {
    notifyHR({
      tenant_id: cred.tenant_id,
      candidate_id: intake.candidate_id,
      application_id: intake.application_id!,
      job_id: intake.job_id!,
      first_name: firstName,
      last_name: lastName,
      email,
      job_title: jobTitle,
      reference
    }).catch((e) => console.warn("[public-intake] notifyHR error:", (e as Error).message));
  }

  return respond(200, intake.outcome, {
    ok: true,
    duplicate: intake.outcome === "duplicate",
    reference,
    candidate_id: intake.candidate_id,
    application_id: intake.application_id,
    resume_attached: resumeUploaded
  }, {
    tenantId: cred.tenant_id,
    candidateId: intake.candidate_id ?? undefined,
    applicationId: intake.application_id ?? undefined,
    requestSummary: reqSummary
  });
}
