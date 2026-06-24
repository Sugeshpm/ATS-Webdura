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
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file");
  const fallbackJobId = String(formData.get("job_id") ?? ""); // optional override
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

    // 2. Application link to the job
    const { error: aErr } = await supabase.from("applications").insert({
      tenant_id: me.tenant_id,
      candidate_id: (cand as { id: string }).id,
      job_id: jobId,
      current_stage_id: sourcedStageId,
      applied_via: "csv_import",
      created_by: user.id
    });
    if (aErr) { failures.push(`${r.first_name}: candidate saved but link to job failed (${aErr.message})`); continue; }

    // 3. Skills
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
          await supabase.from("candidate_skills").insert(all.map((s) => ({ candidate_id: (cand as { id: string }).id, skill_id: s.id })));
        }
      }
    }

    inserted++;
  }

  return Response.json({ inserted, skipped, failures: failures.slice(0, 20) });
}
