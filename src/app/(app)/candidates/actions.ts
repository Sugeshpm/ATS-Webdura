"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Delete a candidate (and via FK cascade: their applications, history, notes, messages, docs). */
export async function deleteCandidate(candidateId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("candidates").delete().eq("id", candidateId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/candidates");
  return { ok: true };
}

export async function deleteCandidates(candidateIds: string[]) {
  if (!candidateIds.length) return { ok: true, deleted: 0 };
  const supabase = await createClient();
  const { error, count } = await supabase.from("candidates").delete({ count: "exact" }).in("id", candidateIds);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/candidates");
  return { ok: true, deleted: count ?? candidateIds.length };
}

export async function deleteCandidateAndRedirect(candidateId: string) {
  const result = await deleteCandidate(candidateId);
  if (result.ok) redirect("/candidates");
  return result;
}

export async function updateCandidate(candidateId: string, patch: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase.from("candidates").update(patch as never).eq("id", candidateId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/candidates");
  return { ok: true };
}
