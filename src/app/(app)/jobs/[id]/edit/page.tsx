import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditJobForm } from "@/components/jobs/edit-job-form";

export const dynamic = "force-dynamic";

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: job },
    { data: departments },
    { data: locations },
    { data: businessUnits },
    { data: members },
    { data: teamRows }
  ] = await Promise.all([
    supabase.from("jobs").select("id, title, department_id, location_id, business_unit_id, description, skills, employment_type, experience_min, experience_max, salary_min, salary_max, salary_currency, openings, priority, confidential, target_close_date, status, visibility").eq("id", id).single(),
    supabase.from("departments").select("id, name").eq("is_archived", false).order("name"),
    supabase.from("locations").select("id, name").eq("is_archived", false).order("name"),
    supabase.from("business_units").select("id, name").eq("is_archived", false).order("name"),
    // Only active members are eligible for hiring-team assignment.
    supabase.from("profiles").select("id, first_name, last_name, email").eq("status", "active").order("first_name"),
    // Existing team rows for this job — used to seed the picker.
    supabase.from("job_team").select("user_id, role_on_job").eq("job_id", id)
  ]);

  if (!job) return notFound();

  const initialTeam = {
    hiring_manager_ids: (teamRows ?? []).filter((r: any) => r.role_on_job === "hiring_manager").map((r: any) => r.user_id as string),
    recruiter_ids:      (teamRows ?? []).filter((r: any) => r.role_on_job === "recruiter").map((r: any) => r.user_id as string),
    interviewer_ids:    (teamRows ?? []).filter((r: any) => r.role_on_job === "interviewer").map((r: any) => r.user_id as string)
  };

  return (
    <EditJobForm
      initial={job as never}
      initialTeam={initialTeam}
      departments={(departments ?? []) as never}
      locations={(locations ?? []) as never}
      businessUnits={(businessUnits ?? []) as never}
      members={(members ?? []) as never}
    />
  );
}
