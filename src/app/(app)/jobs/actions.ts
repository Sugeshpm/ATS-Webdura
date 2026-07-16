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

/**
 * Replace a job's hiring team in a single atomic RPC. Only members whose
 * profile is `status = 'active'` in the caller's tenant may be assigned — the
 * caller is responsible for restricting the picker to that set (see the /jobs
 * edit page fetch).
 *
 * Row-level security on `job_team` still applies because the RPC runs
 * SECURITY INVOKER, so an unauthorized caller can't cross tenants even if
 * they hand-craft the request.
 */
export async function saveJobTeam(
  jobId: string,
  team: { hiring_manager_ids: string[]; recruiter_ids: string[]; interviewer_ids: string[] }
) {
  if (!jobId) return { ok: false as const, error: "Job id is required." };
  const supabase = await createClient();

  // Defensive dedupe + validation that ids are non-empty strings. Anything
  // that isn't a uuid will be rejected by the RPC anyway, but we want a
  // friendlier error surface here.
  const clean = (arr: string[]) => Array.from(new Set((arr ?? []).filter((s) => typeof s === "string" && s.length > 0)));
  const hm = clean(team.hiring_manager_ids);
  const rec = clean(team.recruiter_ids);
  const int = clean(team.interviewer_ids);

  // Guard: refuse to add users who aren't active in this tenant. RLS on
  // profiles hides other tenants' users, so we just need to check status.
  const allIds = Array.from(new Set([...hm, ...rec, ...int]));
  if (allIds.length) {
    const { data: allowed, error: pErr } = await supabase
      .from("profiles")
      .select("id")
      .in("id", allIds)
      .eq("status", "active");
    if (pErr) return { ok: false as const, error: pErr.message };
    const allowedIds = new Set((allowed ?? []).map((p) => (p as { id: string }).id));
    if (allowedIds.size !== allIds.length) {
      return { ok: false as const, error: "One or more selected users are not active members of your tenant." };
    }
  }

  const { error } = await supabase.rpc("replace_job_team", {
    p_job_id: jobId,
    p_hiring_manager_ids: hm,
    p_recruiter_ids: rec,
    p_interviewer_ids: int
  });
  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/jobs/${jobId}/edit`);
  revalidatePath("/jobs");
  return { ok: true as const };
}
