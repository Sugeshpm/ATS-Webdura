"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CandidateCategory = "active" | "talent_pool" | "archived" | "duplicate";
const CATEGORIES: CandidateCategory[] = ["active", "talent_pool", "archived", "duplicate"];

/** Delete a candidate (cascades to applications, history, notes, messages, docs). */
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

/** Move one candidate to a new category. Logs to audit_logs. */
export async function moveCandidateCategory(candidateId: string, to: CandidateCategory) {
  if (!CATEGORIES.includes(to)) return { ok: false as const, error: "Invalid category." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in." };
  const { data: me } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single();
  if (!me) return { ok: false as const, error: "Profile not found." };

  const { data: before } = await supabase
    .from("candidates")
    .select("category")
    .eq("id", candidateId)
    .single();
  const fromCategory = (before as { category?: string } | null)?.category ?? null;
  if (fromCategory === to) return { ok: true as const, unchanged: true };

  const { error } = await supabase
    .from("candidates")
    .update({ category: to } as never)
    .eq("id", candidateId);
  if (error) return { ok: false as const, error: error.message };

  // Audit log (best effort)
  await supabase.from("audit_logs").insert({
    tenant_id: me.tenant_id,
    actor_id: user.id,
    action: "move_candidate_category",
    entity: "candidate",
    entity_id: candidateId,
    before: { category: fromCategory },
    after: { category: to }
  } as never);

  revalidatePath("/candidates");
  return { ok: true as const };
}

/** Move many candidates in one shot. Returns count moved and any failures. */
export async function moveCandidatesCategory(candidateIds: string[], to: CandidateCategory) {
  if (!candidateIds.length) return { ok: true as const, moved: 0 };
  if (!CATEGORIES.includes(to)) return { ok: false as const, error: "Invalid category." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in." };
  const { data: me } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single();
  if (!me) return { ok: false as const, error: "Profile not found." };

  // Read current categories so the audit log captures the per-row delta.
  const { data: before } = await supabase
    .from("candidates")
    .select("id, category")
    .in("id", candidateIds);

  const { error, count } = await supabase
    .from("candidates")
    .update({ category: to } as never, { count: "exact" })
    .in("id", candidateIds);
  if (error) return { ok: false as const, error: error.message };

  // Audit log per row
  const rows = (before ?? []) as { id: string; category: string }[];
  if (rows.length) {
    await supabase.from("audit_logs").insert(
      rows.map((r) => ({
        tenant_id: me.tenant_id,
        actor_id: user.id,
        action: "move_candidate_category",
        entity: "candidate",
        entity_id: r.id,
        before: { category: r.category },
        after: { category: to }
      })) as never
    );
  }

  revalidatePath("/candidates");
  return { ok: true as const, moved: count ?? candidateIds.length };
}

// Note CRUD (unchanged)
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
