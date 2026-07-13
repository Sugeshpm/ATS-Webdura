import { createServiceClient } from "@/lib/supabase/admin";

export interface IntakePayload {
  tenant_id: string;
  first_name: string;
  last_name: string | null;
  email: string;
  phone: string | null;
  experience_years: number | null;
  job_title: string;
  default_job_id: string | null;
  source: string;                // usually "wordpress_careers"
}

export interface IntakeResult {
  outcome: "inserted" | "duplicate" | "rejected";
  candidate_id: string | null;
  application_id: string | null;
  job_id: string | null;
  error?: string;
}

/**
 * Match `payload.job_title` against tenant's jobs:
 *   1. Case-insensitive exact match on title
 *   2. Case-insensitive `ILIKE %title%` (only if exactly one match)
 *   3. Fall back to `default_job_id` from the credential
 */
async function resolveJobId(payload: IntakePayload): Promise<string | null> {
  const admin = createServiceClient();
  const title = payload.job_title.trim();
  if (title) {
    const { data: exact } = await admin
      .from("jobs").select("id")
      .eq("tenant_id", payload.tenant_id)
      .ilike("title", title)
      .limit(1);
    if (exact?.length) return (exact[0] as { id: string }).id;

    const { data: fuzzy } = await admin
      .from("jobs").select("id")
      .eq("tenant_id", payload.tenant_id)
      .ilike("title", `%${title}%`)
      .limit(2);
    if (fuzzy?.length === 1) return (fuzzy[0] as { id: string }).id;
  }
  return payload.default_job_id;
}

/** Dedup candidate by (tenant, email); create if absent. Returns candidate id. */
async function upsertCandidate(payload: IntakePayload): Promise<{ id: string; created: boolean; error?: string }> {
  const admin = createServiceClient();
  const email = payload.email.trim().toLowerCase();

  const { data: existing } = await admin
    .from("candidates").select("id")
    .eq("tenant_id", payload.tenant_id)
    .eq("email", email)
    .maybeSingle();
  if (existing) return { id: (existing as { id: string }).id, created: false };

  const insert: Record<string, unknown> = {
    tenant_id: payload.tenant_id,
    first_name: payload.first_name.trim(),
    last_name: payload.last_name?.trim() || null,
    email,
    phone: payload.phone?.trim() || null,
    experience_years: payload.experience_years ?? 0,
    source: payload.source
  };
  const { data: inserted, error } = await admin
    .from("candidates").insert(insert as never).select("id").single();
  if (error || !inserted) return { id: "", created: false, error: error?.message ?? "candidate insert failed" };
  return { id: (inserted as { id: string }).id, created: true };
}

/**
 * Full intake: resolve job → upsert candidate → link application (idempotent per candidate+job).
 * Returns "duplicate" if this candidate already has an application to this job.
 */
export async function upsertIntake(payload: IntakePayload): Promise<IntakeResult> {
  const admin = createServiceClient();

  const jobId = await resolveJobId(payload);
  if (!jobId) {
    return {
      outcome: "rejected", candidate_id: null, application_id: null, job_id: null,
      error: `No job matches "${payload.job_title}" and no default job is configured for this API key.`
    };
  }

  const cand = await upsertCandidate(payload);
  if (!cand.id) return { outcome: "rejected", candidate_id: null, application_id: null, job_id: jobId, error: cand.error };

  const { data: existingApp } = await admin
    .from("applications").select("id")
    .eq("tenant_id", payload.tenant_id)
    .eq("candidate_id", cand.id)
    .eq("job_id", jobId)
    .maybeSingle();

  if (existingApp) {
    return {
      outcome: "duplicate",
      candidate_id: cand.id,
      application_id: (existingApp as { id: string }).id,
      job_id: jobId
    };
  }

  const { data: sourcedStage } = await admin
    .from("stages").select("id")
    .eq("tenant_id", payload.tenant_id)
    .eq("code", "sourced")
    .maybeSingle();

  const { data: newApp, error: appErr } = await admin
    .from("applications").insert({
      tenant_id: payload.tenant_id,
      candidate_id: cand.id,
      job_id: jobId,
      current_stage_id: (sourcedStage as { id: string } | null)?.id ?? null,
      applied_via: "wordpress_careers"
    } as never).select("id").single();

  if (appErr || !newApp) {
    return {
      outcome: "rejected",
      candidate_id: cand.id, application_id: null, job_id: jobId,
      error: appErr?.message ?? "application insert failed"
    };
  }

  return {
    outcome: "inserted",
    candidate_id: cand.id,
    application_id: (newApp as { id: string }).id,
    job_id: jobId
  };
}

/**
 * Upload a resume file to the `resumes` Supabase Storage bucket and insert a
 * documents row pointing at it. Path: <tenant>/<candidate>/<timestamp>-<name>.
 */
export async function attachResume(params: {
  tenant_id: string;
  candidate_id: string;
  file: File;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createServiceClient();

  // Sanitize filename: keep original extension, strip anything weird.
  const orig = params.file.name || "resume.pdf";
  const safe = orig.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 200);
  const storagePath = `${params.tenant_id}/${params.candidate_id}/${Date.now()}-${safe}`;

  const buf = Buffer.from(await params.file.arrayBuffer());
  const { error: upErr } = await admin.storage.from("resumes").upload(storagePath, buf, {
    contentType: params.file.type || "application/octet-stream",
    upsert: false
  });
  if (upErr) return { ok: false, error: `resume upload failed: ${upErr.message}` };

  const { error: docErr } = await admin.from("documents").insert({
    tenant_id: params.tenant_id,
    candidate_id: params.candidate_id,
    kind: "resume",
    name: orig,
    mime: params.file.type || null,
    size_bytes: params.file.size,
    storage_bucket: "resumes",
    storage_path: storagePath
  } as never);
  if (docErr) return { ok: false, error: `documents insert failed: ${docErr.message}` };

  return { ok: true };
}
