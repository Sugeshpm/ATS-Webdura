import { createServiceClient } from "@/lib/supabase/admin";

/**
 * AI shortlisting core — one evaluation from resume + JD → structured score.
 *
 *   evaluateApplication(applicationId, opts)
 *     • Looks up application, candidate, job, latest resume document.
 *     • Fetches resume bytes (public folder via HTTP, or Supabase Storage via download()).
 *     • Calls Anthropic Messages API with tool-use for structured output.
 *     • Records the row in ai_evaluations, denormalizes state onto applications.
 *     • Increments tenant monthly spend on ai_settings.
 *     • Idempotent per (application_id, prompt_version) inside a 24h window.
 *
 * No SDK dependency — plain fetch. Set ANTHROPIC_API_KEY on Vercel.
 */

export type Verdict = "shortlisted" | "borderline" | "not_shortlisted" | "no_resume" | "error";

export interface EvaluationResult {
  application_id: string;
  status: "ok" | "cached" | "skipped" | "error";
  score?: number;
  verdict?: Verdict;
  summary?: string;
  strengths?: string[];
  gaps?: string[];
  cost_usd?: number;
  error?: string;
  cached_from?: string; // evaluation id if returned from cache
}

interface EvaluationOptions {
  /** If true, ignore the 24h idempotency cache and always call the API. */
  force?: boolean;
  /** Override the settings-configured model for this call (used in tests). */
  modelOverride?: string;
}

// -----------------------------------------------------------------------------
// Prompt
// -----------------------------------------------------------------------------
const PROMPT_VERSION = "v1";
const SYSTEM_PROMPT = `You are an experienced recruiter helping shortlist candidates for a specific role.

You will receive:
  1. A job description (the JD).
  2. A candidate's resume as an attached document (usually PDF).

Score how well the candidate matches the JD on a 0–100 scale using ONLY skills, work experience, education, and JD-stated requirements.

CRITICAL guardrails — do NOT factor any of these into the score:
  • Name, gender, marital status, age, religion, caste, nationality
  • Photograph
  • Location, unless the JD explicitly requires or forbids a specific location
  • Anything that could be discriminatory under Indian or EU employment law

Scoring rubric:
  • 90–100: excellent match — nearly all critical requirements + significant relevant experience
  • 70–89:  strong match — meets most critical requirements
  • 50–69:  partial match — meets some requirements; notable gaps
  • 25–49:  weak match — few requirements met
  • 0–24:   very weak — outside the domain

Call the record_match_score tool with your assessment. Keep the summary to 1–3 sentences of neutral, factual reasoning. Keep strengths and gaps to 3–6 concise phrases each.`;

// -----------------------------------------------------------------------------
// Anthropic client (direct fetch)
// -----------------------------------------------------------------------------

const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

interface AnthropicResponse {
  id: string;
  content: Array<
    | { type: "text"; text: string }
    | { type: "tool_use"; id: string; name: string; input: unknown }
  >;
  stop_reason: string;
  usage: { input_tokens: number; output_tokens: number };
}

interface ScoreInput {
  score: number;
  verdict: Exclude<Verdict, "no_resume" | "error">;
  summary: string;
  strengths: string[];
  gaps: string[];
}

async function callClaude(params: {
  model: string;
  jd: string;
  resumeBase64: string;
  resumeMediaType: string;
}): Promise<{ input: ScoreInput; input_tokens: number; output_tokens: number }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set on the server.");

  const body = {
    model: params.model,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: params.resumeMediaType, data: params.resumeBase64 }
          },
          {
            type: "text",
            text: `Here is the job description to score against:\n\n---\n${params.jd}\n---\n\nEvaluate the attached resume against this JD.`
          }
        ]
      }
    ],
    tools: [
      {
        name: "record_match_score",
        description: "Record the candidate's match score for this specific job.",
        input_schema: {
          type: "object",
          properties: {
            score: { type: "integer", minimum: 0, maximum: 100 },
            verdict: { type: "string", enum: ["shortlisted", "borderline", "not_shortlisted"] },
            summary: { type: "string", description: "1-3 sentence rationale" },
            strengths: { type: "array", items: { type: "string" } },
            gaps: { type: "array", items: { type: "string" } }
          },
          required: ["score", "verdict", "summary", "strengths", "gaps"]
        }
      }
    ],
    tool_choice: { type: "tool", name: "record_match_score" }
  };

  const res = await fetch(ANTHROPIC_ENDPOINT, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = (await res.json()) as AnthropicResponse;
  const toolUse = data.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Anthropic response missing tool_use content block.");
  }
  const input = toolUse.input as ScoreInput;

  // Sanity: ensure the model actually returned all fields.
  if (typeof input.score !== "number" || !input.verdict || !input.summary) {
    throw new Error("Anthropic tool_use payload malformed.");
  }
  input.strengths = Array.isArray(input.strengths) ? input.strengths : [];
  input.gaps = Array.isArray(input.gaps) ? input.gaps : [];

  return { input, input_tokens: data.usage.input_tokens, output_tokens: data.usage.output_tokens };
}

// -----------------------------------------------------------------------------
// Cost estimation (approximate — matches Haiku 4.5 published pricing bracket)
// -----------------------------------------------------------------------------
const COST_TABLE: Record<string, { input_per_million: number; output_per_million: number }> = {
  "claude-haiku-4-5-20251001":   { input_per_million: 1.00, output_per_million: 5.00 },
  "claude-sonnet-5":             { input_per_million: 3.00, output_per_million: 15.00 },
  "claude-opus-4-8":             { input_per_million: 15.00, output_per_million: 75.00 },
  "claude-opus-4-7":             { input_per_million: 15.00, output_per_million: 75.00 }
};

function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = COST_TABLE[model] ?? COST_TABLE["claude-haiku-4-5-20251001"];
  return (inputTokens / 1_000_000) * p.input_per_million + (outputTokens / 1_000_000) * p.output_per_million;
}

// -----------------------------------------------------------------------------
// Resume fetch — both storage backends
// -----------------------------------------------------------------------------

interface ResumeBytes {
  bytes: Buffer;
  mediaType: string;
  documentId: string;
  filename: string;
}

async function fetchResumeForCandidate(
  admin: ReturnType<typeof createServiceClient>,
  candidateId: string
): Promise<ResumeBytes | null> {
  // Latest resume document for this candidate.
  const { data: doc } = await admin
    .from("documents")
    .select("id, name, mime, storage_bucket, storage_path")
    .eq("candidate_id", candidateId)
    .eq("kind", "resume")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!doc) return null;

  const d = doc as {
    id: string; name: string; mime: string | null;
    storage_bucket: string; storage_path: string;
  };

  const mediaType = (d.mime ?? mimeFromName(d.name)) || "application/pdf";
  let bytes: Buffer;

  if (d.storage_bucket === "public_resumes") {
    // Public folder — served by Vercel's CDN. Fetch via HTTPS.
    const base = process.env.NEXT_PUBLIC_APP_URL || "https://ats-webdura.vercel.app";
    const cleaned = d.storage_path.replace(/^[\\/]+/, "").replace(/\\/g, "/");
    const url = `${base.replace(/\/$/, "")}/Resumes/${encodeURI(cleaned)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Public resume fetch failed (HTTP ${res.status}) for ${url}`);
    bytes = Buffer.from(await res.arrayBuffer());
  } else {
    const { data, error } = await admin.storage.from(d.storage_bucket).download(d.storage_path);
    if (error || !data) throw new Error(`Storage download failed: ${error?.message ?? "unknown error"}`);
    bytes = Buffer.from(await data.arrayBuffer());
  }

  return { bytes, mediaType, documentId: d.id, filename: d.name };
}

function mimeFromName(name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  switch (ext) {
    case "pdf":  return "application/pdf";
    case "doc":  return "application/msword";
    case "docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    default:     return "application/octet-stream";
  }
}

// -----------------------------------------------------------------------------
// Settings + cost cap
// -----------------------------------------------------------------------------

async function loadSettings(admin: ReturnType<typeof createServiceClient>, tenantId: string) {
  const { data } = await admin.from("ai_settings").select("*").eq("tenant_id", tenantId).maybeSingle();
  if (data) return data as {
    tenant_id: string;
    enabled: boolean;
    auto_run: boolean;
    score_threshold: number;
    model: string;
    monthly_cost_cap_usd: number;
    current_month_spend_usd: number;
    current_month_started_at: string;
  };
  // Insert defaults on first read.
  const { data: created } = await admin.from("ai_settings").insert({ tenant_id: tenantId } as never).select("*").single();
  return created as never;
}

async function incrementSpend(
  admin: ReturnType<typeof createServiceClient>,
  tenantId: string,
  cost: number
) {
  // Reset the counter if we've rolled into a new calendar month.
  const now = new Date();
  const { data: s } = await admin
    .from("ai_settings")
    .select("current_month_started_at, current_month_spend_usd")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const row = s as { current_month_started_at: string; current_month_spend_usd: number } | null;
  if (!row) return;

  const startedAt = new Date(row.current_month_started_at);
  const sameMonth = startedAt.getUTCFullYear() === now.getUTCFullYear() && startedAt.getUTCMonth() === now.getUTCMonth();
  const nextSpend = sameMonth ? Number(row.current_month_spend_usd) + cost : cost;
  await admin
    .from("ai_settings")
    .update({
      current_month_spend_usd: nextSpend,
      current_month_started_at: sameMonth ? row.current_month_started_at : now.toISOString()
    } as never)
    .eq("tenant_id", tenantId);
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export async function evaluateApplication(
  applicationId: string,
  opts: EvaluationOptions = {},
  actingUserId: string | null = null
): Promise<EvaluationResult> {
  const admin = createServiceClient();

  // 1. Look up the application, candidate id, job info.
  const { data: appRow } = await admin
    .from("applications")
    .select("id, tenant_id, candidate_id, job_id")
    .eq("id", applicationId)
    .maybeSingle();
  if (!appRow) return { application_id: applicationId, status: "error", error: "Application not found." };
  const app = appRow as { id: string; tenant_id: string; candidate_id: string; job_id: string };

  // 2. Settings gate + cost cap.
  const settings = await loadSettings(admin, app.tenant_id);
  if (!settings.enabled) {
    return { application_id: applicationId, status: "skipped", error: "AI shortlisting is disabled for this tenant." };
  }
  if (Number(settings.current_month_spend_usd) >= Number(settings.monthly_cost_cap_usd)) {
    return { application_id: applicationId, status: "skipped", error: "Monthly AI spend cap reached." };
  }

  // 3. Idempotency — reuse a recent evaluation for the same prompt version.
  if (!opts.force) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: prior } = await admin
      .from("ai_evaluations")
      .select("id, score, verdict, summary, strengths, gaps, cost_usd")
      .eq("application_id", applicationId)
      .eq("prompt_version", PROMPT_VERSION)
      .gte("created_at", oneDayAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (prior) {
      const p = prior as { id: string; score: number; verdict: Verdict; summary: string; strengths: string[]; gaps: string[]; cost_usd: number };
      return {
        application_id: applicationId, status: "cached", cached_from: p.id,
        score: p.score, verdict: p.verdict, summary: p.summary,
        strengths: p.strengths, gaps: p.gaps, cost_usd: Number(p.cost_usd) || 0
      };
    }
  }

  // 4. Load JD and resume.
  const { data: jobRow } = await admin.from("jobs").select("id, title, description").eq("id", app.job_id).maybeSingle();
  const jd = ((jobRow as { description?: string } | null)?.description ?? "").trim();
  if (!jd) {
    await recordEvaluation(admin, {
      app, documentId: null, score: 0, verdict: "error",
      summary: "Job has no description.", strengths: [], gaps: [],
      model: opts.modelOverride ?? settings.model, input_tokens: 0, output_tokens: 0,
      cost: 0, error: "job_missing_description", createdBy: actingUserId
    });
    return { application_id: applicationId, status: "error", error: "Job description is empty." };
  }

  let resume: ResumeBytes | null = null;
  try {
    resume = await fetchResumeForCandidate(admin, app.candidate_id);
  } catch (e) {
    console.warn("[ai/shortlist] resume fetch failed:", (e as Error).message);
    // Fall through with resume=null so we record "no_resume" for review.
  }
  if (!resume) {
    await recordEvaluation(admin, {
      app, documentId: null, score: 0, verdict: "no_resume",
      summary: "Candidate has no resume on file.", strengths: [], gaps: [],
      model: opts.modelOverride ?? settings.model, input_tokens: 0, output_tokens: 0,
      cost: 0, error: null, createdBy: actingUserId
    });
    await updateApplicationState(admin, app.id, "no_resume", 0);
    return { application_id: applicationId, status: "ok", score: 0, verdict: "no_resume", summary: "Candidate has no resume on file.", strengths: [], gaps: [], cost_usd: 0 };
  }

  // Anthropic's document content block accepts PDF only. Reject DOC/DOCX
  // up-front rather than sending a mislabeled body and getting a cryptic 400.
  const isPdf = resume.mediaType.toLowerCase().includes("pdf") || resume.filename.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    const msg = `Resume format not supported by AI shortlisting (only PDF; got "${resume.mediaType}"). Ask the candidate for a PDF copy.`;
    await recordEvaluation(admin, {
      app, documentId: resume.documentId, score: 0, verdict: "error",
      summary: msg, strengths: [], gaps: [],
      model: opts.modelOverride ?? settings.model, input_tokens: 0, output_tokens: 0,
      cost: 0, error: "unsupported_media_type", createdBy: actingUserId
    });
    return { application_id: applicationId, status: "error", error: msg };
  }

  // 5. Call Claude.
  const model = opts.modelOverride ?? settings.model;
  let result: ScoreInput;
  let input_tokens = 0;
  let output_tokens = 0;
  try {
    const strip = resume.bytes.toString("base64");
    // Anthropic supports PDF up to ~32 MB base64. Our cap is 10 MB so we're fine.
    const c = await callClaude({
      model,
      jd,
      resumeBase64: strip,
      resumeMediaType: "application/pdf"
    });
    result = c.input;
    input_tokens = c.input_tokens;
    output_tokens = c.output_tokens;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await recordEvaluation(admin, {
      app, documentId: resume.documentId, score: 0, verdict: "error",
      summary: null, strengths: [], gaps: [],
      model, input_tokens: 0, output_tokens: 0, cost: 0, error: msg, createdBy: actingUserId
    });
    return { application_id: applicationId, status: "error", error: msg };
  }

  const cost = estimateCostUsd(model, input_tokens, output_tokens);

  // 6. Normalize verdict against tenant threshold.
  const verdict: Verdict = result.score >= settings.score_threshold
    ? "shortlisted"
    : (result.score >= Math.max(0, settings.score_threshold - 15) ? "borderline" : "not_shortlisted");

  // 7. Persist evaluation + denormalized state + spend.
  await recordEvaluation(admin, {
    app, documentId: resume.documentId,
    score: result.score, verdict,
    summary: result.summary, strengths: result.strengths, gaps: result.gaps,
    model, input_tokens, output_tokens, cost, error: null, createdBy: actingUserId
  });
  await updateApplicationState(admin, app.id, verdict, result.score);
  await incrementSpend(admin, app.tenant_id, cost);

  return {
    application_id: applicationId,
    status: "ok",
    score: result.score, verdict, summary: result.summary,
    strengths: result.strengths, gaps: result.gaps, cost_usd: cost
  };
}

// -----------------------------------------------------------------------------
async function recordEvaluation(
  admin: ReturnType<typeof createServiceClient>,
  p: {
    app: { id: string; tenant_id: string; candidate_id: string; job_id: string };
    documentId: string | null;
    score: number;
    verdict: Verdict;
    summary: string | null;
    strengths: string[];
    gaps: string[];
    model: string;
    input_tokens: number;
    output_tokens: number;
    cost: number;
    error: string | null;
    createdBy: string | null;
  }
) {
  await admin.from("ai_evaluations").insert({
    tenant_id: p.app.tenant_id,
    application_id: p.app.id,
    candidate_id: p.app.candidate_id,
    job_id: p.app.job_id,
    document_id: p.documentId,
    score: p.score,
    verdict: p.verdict,
    summary: p.summary,
    strengths: p.strengths,
    gaps: p.gaps,
    model: p.model,
    prompt_version: PROMPT_VERSION,
    input_tokens: p.input_tokens,
    output_tokens: p.output_tokens,
    cost_usd: p.cost,
    error: p.error,
    created_by: p.createdBy
  } as never);
}

async function updateApplicationState(
  admin: ReturnType<typeof createServiceClient>,
  applicationId: string,
  verdict: Verdict,
  score: number
) {
  await admin
    .from("applications")
    .update({ ai_status: verdict, ai_score: score, ai_evaluated_at: new Date().toISOString() } as never)
    .eq("id", applicationId);
}

// -----------------------------------------------------------------------------
export { PROMPT_VERSION };
