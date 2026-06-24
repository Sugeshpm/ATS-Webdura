import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditJobForm } from "@/components/jobs/edit-job-form";

export const dynamic = "force-dynamic";

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: job }, { data: departments }, { data: locations }, { data: businessUnits }] = await Promise.all([
    supabase.from("jobs").select("id, title, department_id, location_id, business_unit_id, description, skills, employment_type, experience_min, experience_max, salary_min, salary_max, salary_currency, openings, priority, confidential, target_close_date, status, visibility").eq("id", id).single(),
    supabase.from("departments").select("id, name").eq("is_archived", false).order("name"),
    supabase.from("locations").select("id, name").eq("is_archived", false).order("name"),
    supabase.from("business_units").select("id, name").eq("is_archived", false).order("name")
  ]);

  if (!job) return notFound();

  return (
    <EditJobForm
      initial={job as never}
      departments={(departments ?? []) as never}
      locations={(locations ?? []) as never}
      businessUnits={(businessUnits ?? []) as never}
    />
  );
}
