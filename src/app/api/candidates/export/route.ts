import { createClient } from "@/lib/supabase/server";
import { csvDownloadResponse, toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jobId = url.searchParams.get("job");
  const view = url.searchParams.get("view") ?? "all";
  const supabase = await createClient();

  let q = supabase
    .from("applications")
    .select(`
      applied_at,
      updated_at,
      applied_via,
      job:jobs ( title ),
      stage:stages ( name ),
      candidate:candidates (
        first_name, middle_name, last_name, email, phone, gender, date_of_birth,
        current_company, current_location, preferred_location,
        experience_years, experience_months, notice_period_days,
        current_salary, current_salary_currency, expected_salary, expected_salary_currency,
        source, linkedin_url, github_url, portfolio_url
      )
    `)
    .order("updated_at", { ascending: false })
    .limit(5000);

  if (view === "archived") q = q.eq("is_archived", true); else q = q.eq("is_archived", false);
  if (jobId) q = q.eq("job_id", jobId);

  const { data, error } = await q;
  if (error) return new Response(error.message, { status: 500 });

  const flat = (data ?? []).map((a) => {
    const c = (a as any).candidate ?? {};
    const j = (a as any).job ?? {};
    const s = (a as any).stage ?? {};
    return {
      first_name: c.first_name,
      middle_name: c.middle_name,
      last_name: c.last_name,
      email: c.email,
      phone: c.phone,
      gender: c.gender,
      date_of_birth: c.date_of_birth,
      job_title: j.title,
      stage: s.name,
      experience_years: c.experience_years,
      experience_months: c.experience_months,
      notice_period_days: c.notice_period_days,
      current_company: c.current_company,
      current_location: c.current_location,
      preferred_location: c.preferred_location,
      current_salary: c.current_salary,
      current_salary_currency: c.current_salary_currency,
      expected_salary: c.expected_salary,
      expected_salary_currency: c.expected_salary_currency,
      source: c.source,
      applied_via: a.applied_via,
      applied_at: a.applied_at,
      updated_at: a.updated_at,
      linkedin_url: c.linkedin_url,
      github_url: c.github_url,
      portfolio_url: c.portfolio_url
    };
  });

  const csv = toCsv(flat, [
    "first_name", "middle_name", "last_name", "email", "phone", "gender", "date_of_birth",
    "job_title", "stage", "experience_years", "experience_months", "notice_period_days",
    "current_company", "current_location", "preferred_location",
    "current_salary", "current_salary_currency", "expected_salary", "expected_salary_currency",
    "source", "applied_via", "applied_at", "updated_at",
    "linkedin_url", "github_url", "portfolio_url"
  ] as never);

  const stamp = new Date().toISOString().slice(0, 10);
  return csvDownloadResponse(`candidates-${stamp}.csv`, csv);
}
