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

export async function archiveCandidate(candidateId: string, reason?: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("candidates")
    .update({ is_archived: true, archive_reason: reason ?? null } as never)
    .eq("id", candidateId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/candidates");
  return { ok: true };
}

export async function unarchiveCandidate(candidateId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("candidates")
    .update({ is_archived: false, archive_reason: null } as never)
    .eq("id", candidateId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/candidates");
  return { ok: true };
}

export async function addNote(applicationId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Empty note." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const { data: me } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single();
  if (!me) return { ok: false, error: "No profile." };
  const { error } = await supabase.from("notes").insert({
    tenant_id: me.tenant_id, application_id: applicationId, author_id: user.id, body: trimmed
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateNote(noteId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Empty note." };
  const supabase = await createClient();
  const { error } = await supabase.from("notes").update({ body: trimmed } as never).eq("id", noteId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteNote(noteId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("notes").delete().eq("id", noteId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
