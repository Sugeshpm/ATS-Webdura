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

function errorResponse(msg: string, status = 400, extra?: Record<string, unknown>) {
  return Response.json({ error: msg, ...extra }, { status });
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return errorResponse("No file uploaded.");

  const text = await file.text();
  const { rows, errors } = parseCsv<JobCsvRow>(text);
  if (errors.length) return errorResponse("CSV parse errors", 400, { details: errors });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return errorResponse("Not authenticated.", 401);

  const { data: me } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single();
  if (!me) return errorResponse("Tenant not found.", 403);
  const tenantId = (me as { tenant_id: string }).tenant_id;

  const [{ data: depts }, { data: locs }, { data: bus }] = await Promise.all([
    supabase.from("departments").select("id, name"),
    supabase.from("locations").select("id, name"),
    supabase.from("business_units").select("id, name")
  ]);
  const idFor = (list: { id: string; name: string }[] | null, name?: string) =>
    !name ? null : list?.find((x) => x.name.toLowerCase() === name.trim().toLowerCase())?.id ?? null;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      emit({ type: "start", total: rows.length });

      let inserted = 0;
      let skipped = 0;
      const failures: string[] = [];

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const label = r.title?.trim() || `Row ${i + 1}`;
        if (!r.title?.trim()) {
          skipped++;
          failures.push(`Row ${i + 1}: missing title`);
          emit({ type: "row", index: i, name: label, status: "skip", reason: "missing title" });
          continue;
        }

        const { error } = await supabase.from("jobs").insert({
          tenant_id: tenantId,
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
        } as never);

        if (error) {
          skipped++;
          failures.push(`${label}: ${error.message}`);
          emit({ type: "row", index: i, name: label, status: "fail", reason: error.message });
        } else {
          inserted++;
          emit({ type: "row", index: i, name: label, status: "ok" });
        }
      }

      emit({ type: "done", total: rows.length, inserted, skipped, failures: failures.slice(0, 30) });
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
