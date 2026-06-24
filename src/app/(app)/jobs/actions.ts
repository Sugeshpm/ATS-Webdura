"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function deleteJob(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("jobs").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/jobs");
  return { ok: true };
}

export async function deleteJobs(ids: string[]) {
  if (!ids.length) return { ok: true, deleted: 0 };
  const supabase = await createClient();
  const { error, count } = await supabase.from("jobs").delete({ count: "exact" }).in("id", ids);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/jobs");
  return { ok: true, deleted: count ?? ids.length };
}

export async function deleteJobAndRedirect(id: string) {
  const result = await deleteJob(id);
  if (result.ok) redirect("/jobs");
  return result;
}

export async function updateJob(id: string, patch: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase.from("jobs").update(patch as never).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/jobs/${id}`);
  revalidatePath("/jobs");
  return { ok: true };
}
