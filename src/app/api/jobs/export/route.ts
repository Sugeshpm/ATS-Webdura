import { createClient } from "@/lib/supabase/server";
import { csvDownloadResponse, toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status"); // optional
  const supabase = await createClient();

  let q = supabase
    .from("v_jobs_with_counts")
    .select("title, department_name, location_name, business_unit_name, employment_type, experience_min, experience_max, openings, hires, salary_min, salary_max, salary_currency, priority, confidential, status, visibility, target_close_date, skills, candidate_count, archived_candidates_count, created_at")
    .order("created_at", { ascending: false });
  if (status && status !== "all") q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return new Response(error.message, { status: 500 });

  const csv = toCsv(data ?? [], [
    "title", "department_name", "location_name", "business_unit_name",
    "employment_type", "experience_min", "experience_max",
    "openings", "hires", "salary_min", "salary_max", "salary_currency",
    "priority", "confidential", "status", "visibility",
    "target_close_date", "skills", "candidate_count", "archived_candidates_count", "created_at"
  ] as never);

  const stamp = new Date().toISOString().slice(0, 10);
  return csvDownloadResponse(`jobs-${stamp}.csv`, csv);
}
