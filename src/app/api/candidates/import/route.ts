import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@/lib/supabase/server";
import { num, parseCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

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
  /** Path under `public/Resumes/` (case-insensitive header). */
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

/** Safely resolve a CSV-supplied path under public/Resumes. Returns null if traversal detected. */
function resolveResumePath(rel: string): string | null {
  const cleaned = rel.replace(/^[\\/]+/, "").replace(/\\/g, "/").trim();
  if (!cleaned || cleaned.includes("..")) return null;
  const abs = path.join(PUBLIC_RESUMES_ROOT, cleaned);
  // Ensure it stays inside the Resumes root
  const normRoot = path.resolve(PUBLIC_RESUMES_ROOT);
  const normAbs = path.resolve(abs);
  if (!normAbs.startsWith(normRoot)) return null;
  return normAbs;
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file");
  const fallbackJobId = String(formData.get("job_id") ?? "");
  if (!(file instanceof File)) return Response.json({ error: "No file uploaded." }, { status: 400 });

  const text = await file.text();
  const { rows, errors } = parseCsv<CandidateCsvRow>(text);
  if (errors.length) return Response.json({ error: "CSV parse errors", details: errors }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated." }, { status: 401 });

  const { data: me } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single();
  if (!me) return Response.json({ error: "Tenant not found." }, { status: 403 });

  const [{ data: jobs }, { data: stages }] = await Promise.all([
    supabase.from("jobs").select("id, title"),
    supabase.from("stages").select("id, code")
  ]);
  const sourcedStageId = stages?.find((s: { code: string }) => s.code === "sourced")?.id ?? null;
  const jobByTitle = new Map((jobs ?? []).map((j: { id: string; title: string }) => [j.title.toLowerCase(), j.id]));

  let inserted = 0;
  let skipped = 0;
  let resumesUploaded = 0;
  const failures: string[] = [];

  for (const r of rows) {
    if (!r.first_name?.trim()) { skipped++; failures.push(`Row missing first_name`); continue; }

    const jobId = (r.job_title ? jobByTitle.get(r.job_title.trim().toLowerCase()) : null) || fallbackJobId || null;
    if (!jobId) { skipped++; failures.push(`${r.first_name}: no matching job for "${r.job_title ?? "(blank)"}"`); continue; }

    // 1. Insert candidate
    const { data: cand, error: cErr } = await supabase.from("candidates").insert({
      tenant_id: me.tenant_id,
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

    if (cErr || !cand) { skipped++; failures.push(`${r.first_name}: ${cErr?.message ?? "insert failed"}`); continue; }
    const candidateId = (cand as { id: string }).id;

    // 2. Application link to the job
    const { error: aErr } = await supabase.from("applications").insert({
      tenant_id: me.tenant_id,
      candidate_id: candidateId,
      job_id: jobId,
      current_stage_id: sourcedStageId,
      applied_via: "csv_import",
      created_by: user.id
    });
    if (aErr) { failures.push(`${r.first_name}: candidate saved but link to job failed (${aErr.message})`); continue; }

    // 3. Skills (semicolon-separated)
    if (r.skills) {
      const skillNames = r.skills.split(";").map((s) => s.trim()).filter(Boolean);
      if (skillNames.length) {
        const { data: existing } = await supabase.from("skills").select("id, name").eq("tenant_id", me.tenant_id).in("name", skillNames);
        const have = new Set((existing ?? []).map((s: { name: string }) => s.name.toLowerCase()));
        const toInsert = skillNames.filter((s) => !have.has(s.toLowerCase()));
        let ins: { id: string; name: string }[] = [];
        if (toInsert.length) {
          const { data: insData } = await supabase.from("skills").insert(toInsert.map((name) => ({ tenant_id: me.tenant_id, name })) as never).select("id, name");
          ins = (insData ?? []) as never;
        }
        const all = [...(existing ?? []), ...ins] as { id: string }[];
        if (all.length) {
          await supabase.from("candidate_skills").insert(all.map((s) => ({ candidate_id: candidateId, skill_id: s.id })));
        }
      }
    }

    // 4. Resume: read from public/Resumes, upload to Storage, link via documents row.
    const resumeRel = (r.Resume ?? r.resume ?? "").trim();
    if (resumeRel) {
      const absPath = resolveResumePath(resumeRel);
      if (!absPath) {
        failures.push(`${r.first_name}: resume path looks unsafe ("${resumeRel}") — skipped.`);
      } else {
        try {
          const buffer = await fs.readFile(absPath);
          const fileName = path.basename(absPath);
          const mime = mimeForExt(fileName);
          const storagePath = `${me.tenant_id}/${candidateId}/${Date.now()}-${fileName}`;

          const { error: upErr } = await supabase.storage
            .from("resumes")
            .upload(storagePath, buffer, { contentType: mime, upsert: false });

          if (upErr) {
            failures.push(`${r.first_name}: resume upload failed (${upErr.message})`);
          } else {
            const { error: docErr } = await supabase.from("documents").insert({
              tenant_id: me.tenant_id,
              candidate_id: candidateId,
              kind: "resume",
              name: fileName,
              mime,
              size_bytes: buffer.length,
              storage_bucket: "resumes",
              storage_path: storagePath,
              uploaded_by: user.id
            } as never);
            if (docErr) {
              failures.push(`${r.first_name}: resume uploaded but link failed (${docErr.message})`);
            } else {
              resumesUploaded++;
            }
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("ENOENT")) {
            failures.push(`${r.first_name}: resume not found at public/Resumes/${resumeRel}`);
          } else {
            failures.push(`${r.first_name}: resume read failed (${msg})`);
          }
        }
      }
    }

    inserted++;
  }

  return Response.json({ inserted, skipped, resumes_uploaded: resumesUploaded, failures: failures.slice(0, 30) });
}
