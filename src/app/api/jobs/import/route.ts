import { createClient } from "@/lib/supabase/server";
import { bool, num, parseCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

interface JobCsvRow {
  title?: string;
  department_name?: string;
  location_name?: string;
  business_unit_name?: string;
  employment_type?: string;
  experience_min?: string;
  experience_max?: string;
  description?: string;
  skills?: string;
  salary_min?: string;
  salary_max?: string;
  salary_currency?: string;
  openings?: string;
  priority?: string;
  confidential?: string;
  target_close_date?: string;
  status?: string;
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No file uploaded." }, { status: 400 });

  const text = await file.text();
  const { rows, errors } = parseCsv<JobCsvRow>(text);
  if (errors.length) return Response.json({ error: "CSV parse errors", details: errors }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated." }, { status: 401 });

  const { data: me } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single();
  if (!me) return Response.json({ error: "Tenant not found." }, { status: 403 });

  // Resolve lookup names → ids
  const [{ data: depts }, { data: locs }, { data: bus }] = await Promise.all([
    supabase.from("departments").select("id, name"),
    supabase.from("locations").select("id, name"),
    supabase.from("business_units").select("id, name")
  ]);
  const idFor = (list: { id: string; name: string }[] | null, name?: string) =>
    !name ? null : list?.find((x) => x.name.toLowerCase() === name.trim().toLowerCase())?.id ?? null;

  const records = rows
    .filter((r) => r.title?.trim())
    .map((r) => ({
      tenant_id: me.tenant_id,
      title: r.title!.trim(),
      department_id: idFor(depts as never, r.department_name),
      location_id: idFor(locs as never, r.location_name),
      business_unit_id: idFor(bus as never, r.business_unit_name),
      employment_type: (r.employment_type || "full_time").trim(),
      experience_min: num(r.experience_min) ?? null,
      experience_max: num(r.experience_max) ?? null,
      description: r.description ?? null,
      skills: r.skills ? r.skills.split(";").map((s) => s.trim()).filter(Boolean) : [],
      salary_min: num(r.salary_min) ?? null,
      salary_max: num(r.salary_max) ?? null,
      salary_currency: (r.salary_currency || "INR").trim(),
      openings: num(r.openings) ?? 1,
      priority: bool(r.priority),
      confidential: bool(r.confidential),
      target_close_date: r.target_close_date?.trim() || null,
      status: (["draft", "active", "archived", "closed"].includes((r.status || "").trim()) ? r.status!.trim() : "active") as "draft" | "active" | "archived" | "closed",
      created_by: user.id
    }));

  if (!records.length) return Response.json({ error: "No valid rows (each row needs a title)." }, { status: 400 });

  const { error: insErr, count } = await supabase.from("jobs").insert(records as never, { count: "exact" });
  if (insErr) return Response.json({ error: insErr.message }, { status: 500 });

  return Response.json({ inserted: count ?? records.length, skipped: rows.length - records.length });
}
