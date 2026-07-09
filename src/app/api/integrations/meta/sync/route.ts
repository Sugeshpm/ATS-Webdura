import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto/encrypt";
import { listFormLeads, MetaGraphError } from "@/lib/meta/graph";
import { ingestMetaLead, recordReceivedEvent } from "@/lib/meta/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface Body { form_id: string; since_iso?: string }

export async function POST(req: Request) {
  // Auth check — only signed-in admins can trigger a sync.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { data: me } = await supabase.from("profiles").select("tenant_id, role").eq("id", user.id).single();
  if (!me || !["super_admin", "admin"].includes((me as { role: string }).role)) {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }
  const tenantId = (me as { tenant_id: string }).tenant_id;

  const body = (await req.json().catch(() => ({}))) as Partial<Body>;
  if (!body.form_id) return NextResponse.json({ error: "form_id required" }, { status: 400 });

  const admin = createServiceClient();
  const { data: form } = await admin
    .from("meta_lead_forms")
    .select("form_id, page_id, page_access_token_encrypted, last_synced_at")
    .eq("form_id", body.form_id)
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .maybeSingle();
  if (!form) return NextResponse.json({ error: "form not registered" }, { status: 404 });

  const enc = (form as { page_access_token_encrypted: string | null }).page_access_token_encrypted;
  if (!enc) return NextResponse.json({ error: "no token stored" }, { status: 400 });

  let token: string;
  try { token = decrypt(enc); }
  catch (e) { return NextResponse.json({ error: `decrypt failed: ${(e as Error).message}` }, { status: 500 }); }

  const since = body.since_iso
    ? new Date(body.since_iso)
    : (form as { last_synced_at: string | null }).last_synced_at
      ? new Date((form as { last_synced_at: string }).last_synced_at)
      : undefined;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (o: unknown) => controller.enqueue(encoder.encode(JSON.stringify(o) + "\n"));
      try {
        const leads = await listFormLeads(token, body.form_id!, since);
        emit({ type: "start", total: leads.length });

        // Leads already synced for THIS form (→ this job) whose candidate STILL exists.
        // Re-syncing must not duplicate them. If the candidate was deleted, the FK set
        // candidate_id → null, so it drops out of this set and the lead is re-created.
        const { data: doneRows } = await admin
          .from("meta_leads_raw")
          .select("leadgen_id")
          .eq("tenant_id", tenantId)
          .eq("form_id", body.form_id!)
          .in("status", ["inserted", "duplicate"])
          .not("candidate_id", "is", null);
        const alreadySynced = new Set(
          ((doneRows ?? []) as { leadgen_id: string }[]).map((r) => r.leadgen_id)
        );

        let inserted = 0, duplicate = 0, failed = 0, skipped = 0;
        for (let i = 0; i < leads.length; i++) {
          const l = leads[i];
          if (alreadySynced.has(l.id)) {
            skipped++;
            emit({ type: "row", index: i, leadgen_id: l.id, status: "skipped" });
            continue;
          }
          try {
            await recordReceivedEvent(tenantId, l.id, l.form_id, (form as { page_id: string }).page_id, l.created_time);
            const r = await ingestMetaLead(l.id, l.form_id, (form as { page_id: string }).page_id, l.created_time);
            if (r.status === "inserted") inserted++;
            else if (r.status === "duplicate") duplicate++;
            else failed++;
            emit({ type: "row", index: i, leadgen_id: l.id, status: r.status, error: r.error });
          } catch (e) {
            failed++;
            emit({ type: "row", index: i, leadgen_id: l.id, status: "failed", error: (e as Error).message });
          }
        }

        // Stamp last_synced_at
        await admin.from("meta_lead_forms")
          .update({ last_synced_at: new Date().toISOString() } as never)
          .eq("form_id", body.form_id!)
          .eq("tenant_id", tenantId);

        emit({ type: "done", total: leads.length, inserted, duplicate, failed, skipped });
      } catch (e) {
        const msg = e instanceof MetaGraphError ? e.message : (e as Error).message;
        emit({ type: "error", error: msg });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no"
    }
  });
}
