import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@/lib/supabase/server";
import { num, parseCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";
export const maxDuration = 300;   // Pro plan cap; hobby will still use 60s

interface CandidateCsvRow {
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  gender?: string;
  date_of_birth?: string;
  job_title?: string;
  experience_years?: string;
  experience_months?: string;
  current_company?: string;
  current_location?: string;
  preferred_location?: string;
  current_salary?: string;
  expected_salary?: string;
  source?: string;
  linkedin_url?: string;
  github_url?: string;
  portfolio_url?: string;
  skills?: string;
  Resume?: string;
  resume?: string;
}

const PUBLIC_RESUMES_ROOT = path.join(process.cwd(), "public", "Resumes");

function mimeForExt(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  switch (ext) {
    case "pdf":  return "application/pdf";
    case "doc":  return "application/msword";
    case "docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "rtf":  return "application/rtf";
    case "txt":  return "text/plain";
    default:     return "application/octet-stream";
  }
}

function resolveResumePath(rel: string): string | null {
  const cleaned = rel.replace(/^[\\/]+/, "").replace(/\\/g, "/").trim();
  if (!cleaned || cleaned.includes("..")) return null;
  const abs = path.join(PUBLIC_RESUMES_ROOT, cleaned);
  const normRoot = path.resolve(PUBLIC_RESUMES_ROOT);
  const normAbs = path.resolve(abs);
  if (!normAbs.startsWith(normRoot)) return null;
  return normAbs;
}

/** Return an early JSON error (for validation failures before streaming can start). */
function errorResponse(msg: string, status = 400, extra?: Record<string, unknown>) {
  return Response.json({ error: msg, ...extra }, { status });
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file");
  const fallbackJobId = String(formData.get("job_id") ?? "");
  if (!(file instanceof File)) return errorResponse("No file uploaded.");

  const text = await file.text();
  const { rows, errors } = parseCsv<CandidateCsvRow>(text);
  if (errors.length) return errorResponse("CSV parse errors", 400, { details: errors });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return errorResponse("Not authenticated.", 401);

  const { data: me } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single();
  if (!me) return errorResponse("Tenant not found.", 403);
  const tenantId = (me as { tenant_id: string }).tenant_id;

  const [{ data: jobs }, { data: stages }] = await Promise.all([
    supabase.from("jobs").select("id, title"),
    supabase.from("stages").select("id, code")
  ]);
  const sourcedStageId = stages?.find((s: { code: string }) => s.code === "sourced")?.id ?? null;
  const jobByTitle = new Map((jobs ?? []).map((j: { id: string; title: string }) => [j.title.toLowerCase(), j.id]));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      const total = rows.length;
      emit({ type: "start", total });

      let inserted = 0;
      let skipped = 0;
      let resumesUploaded = 0;
      const failures: string[] = [];

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const rowLabel = (r.first_name?.trim() || `Row ${i + 1}`);

        if (!r.first_name?.trim()) {
          skipped++;
          failures.push(`Row ${i + 1}: missing first_name`);
          emit({ type: "row", index: i, name: rowLabel, status: "skip", reason: "missing first_name" });
          continue;
        }

        const jobId = (r.job_title ? jobByTitle.get(r.job_title.trim().toLowerCase()) : null) || fallbackJobId || null;
        if (!jobId) {
          skipped++;
          const reason = `no matching job for "${r.job_title ?? "(blank)"}"`;
          failures.push(`${rowLabel}: ${reason}`);
          emit({ type: "row", index: i, name: rowLabel, status: "skip", reason });
          continue;
        }

        // Insert candidate
        const { data: cand, error: cErr } = await supabase.from("candidates").insert({
          tenant_id: tenantId,
          first_name: r.first_name.trim(),
          middle_name: r.middle_name?.trim() || null,
          last_name: r.last_name?.trim() || null,
          email: r.email?.trim() || null,
          phone: r.phone?.trim() || null,
          gender: r.gender?.trim() || null,
          date_of_birth: r.date_of_birth?.trim() || null,
          current_company: r.current_company?.trim() || null,
          current_location: r.current_location?.trim() || null,
          preferred_location: r.preferred_location?.trim() || null,
          experience_years: num(r.experience_years) ?? 0,
          experience_months: num(r.experience_months) ?? 0,
          current_salary: num(r.current_salary) ?? null,
          expected_salary: num(r.expected_salary) ?? null,
          source: r.source?.trim() || "csv_import",
          linkedin_url: r.linkedin_url?.trim() || null,
          github_url: r.github_url?.trim() || null,
          portfolio_url: r.portfolio_url?.trim() || null,
          owner_id: user.id
        } as never).select("id").single();

        if (cErr || !cand) {
          skipped++;
          const reason = cErr?.message ?? "insert failed";
          failures.push(`${rowLabel}: ${reason}`);
          emit({ type: "row", index: i, name: rowLabel, status: "fail", reason });
          continue;
        }
        const candidateId = (cand as { id: string }).id;

        // Application link
        const { error: aErr } = await supabase.from("applications").insert({
          tenant_id: tenantId,
          candidate_id: candidateId,
          job_id: jobId,
          current_stage_id: sourcedStageId,
          applied_via: "csv_import",
          created_by: user.id
        });
        if (aErr) {
          failures.push(`${rowLabel}: candidate saved but link to job failed (${aErr.message})`);
          // still count as inserted since candidate row exists
        }

        // Skills
        if (r.skills) {
          const skillNames = r.skills.split(";").map((s) => s.trim()).filter(Boolean);
          if (skillNames.length) {
            const { data: existing } = await supabase.from("skills").select("id, name").eq("tenant_id", tenantId).in("name", skillNames);
            const have = new Set((existing ?? []).map((s: { name: string }) => s.name.toLowerCase()));
            const toInsert = skillNames.filter((s) => !have.has(s.toLowerCase()));
            let ins: { id: string; name: string }[] = [];
            if (toInsert.length) {
              const { data: insData } = await supabase.from("skills")
                .insert(toInsert.map((name) => ({ tenant_id: tenantId, name })) as never)
                .select("id, name");
              ins = (insData ?? []) as never;
            }
            const all = [...(existing ?? []), ...ins] as { id: string }[];
            if (all.length) {
              await supabase.from("candidate_skills").insert(all.map((s) => ({ candidate_id: candidateId, skill_id: s.id })));
            }
          }
        }

        // Resume upload — idempotent:
        //   1. If the candidate already has a resume documents row, skip upload entirely.
        //   2. Use a stable storage path (no timestamp) with upsert:true so any explicit
        //      re-upload replaces the existing object instead of orphaning it.
        let resumeOk = false;
        const resumeRel = (r.Resume ?? r.resume ?? "").trim();
        if (resumeRel) {
          const absPath = resolveResumePath(resumeRel);
          if (!absPath) {
            failures.push(`${rowLabel}: unsafe resume path "${resumeRel}"`);
          } else {
            const { data: existingResume } = await supabase.from("documents")
              .select("id")
              .eq("candidate_id", candidateId)
              .eq("kind", "resume")
              .limit(1)
              .maybeSingle();

            if (existingResume) {
              // Already imported previously; leave the existing documents row untouched.
              resumeOk = true;
            } else {
              try {
                // Confirm the file exists on disk (throws ENOENT if not) — we don't upload
                // anywhere, we just record the public-folder path so the app serves it
                // directly from /Resumes/<...>. Files are committed to git.
                const stat = await fs.stat(absPath);
                const fileName = path.basename(absPath);
                const mime = mimeForExt(fileName);
                // Storage path is the CSV-relative path under public/Resumes/ (e.g. "Content Writer/Alfina L.pdf").
                const relPath = resumeRel.replace(/^[\\/]+/, "").replace(/\\/g, "/");

                const { error: docErr } = await supabase.from("documents").insert({
                  tenant_id: tenantId, candidate_id: candidateId, kind: "resume",
                  name: fileName, mime, size_bytes: stat.size,
                  storage_bucket: "public_resumes", storage_path: relPath, uploaded_by: user.id
                } as never);
                if (docErr) failures.push(`${rowLabel}: could not link resume (${docErr.message})`);
                else { resumesUploaded++; resumeOk = true; }
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                failures.push(
                  msg.includes("ENOENT")
                    ? `${rowLabel}: resume not found at public/Resumes/${resumeRel}`
                    : `${rowLabel}: resume check failed (${msg})`
                );
              }
            }
          }
        }

        inserted++;
        emit({
          type: "row",
          index: i,
          name: rowLabel,
          status: "ok",
          resume: resumeRel ? (resumeOk ? "uploaded" : "failed") : "none"
        });
      }

      emit({
        type: "done",
        total,
        inserted,
        skipped,
        resumes_uploaded: resumesUploaded,
        failures: failures.slice(0, 30)
      });

      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Accel-Buffering": "no"
    }
  });
}
