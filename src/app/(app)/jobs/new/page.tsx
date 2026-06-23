import { createClient } from "@/lib/supabase/server";
import { CreateJobWizard } from "@/components/jobs/create-job-wizard";

export const dynamic = "force-dynamic";

export default async function NewJobPage() {
  const supabase = await createClient();
  const [{ data: departments }, { data: businessUnits }, { data: locations }, { data: members }] = await Promise.all([
    supabase.from("departments").select("id, name").eq("is_archived", false).order("name"),
    supabase.from("business_units").select("id, name").eq("is_archived", false).order("name"),
    supabase.from("locations").select("id, name").eq("is_archived", false).order("name"),
    supabase.from("profiles").select("id, first_name, last_name, email").eq("status", "active").order("first_name")
  ]);

  return (
    <CreateJobWizard
      departments={(departments ?? []) as never}
      businessUnits={(businessUnits ?? []) as never}
      locations={(locations ?? []) as never}
      members={(members ?? []) as never}
    />
  );
}
