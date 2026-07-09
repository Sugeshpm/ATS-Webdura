import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { verifyMetaSignature } from "@/lib/crypto/encrypt";
import { ingestMetaLead, recordReceivedEvent, resolveFormTenant } from "@/lib/meta/ingest";

// Force Node runtime so we get raw body access + Node crypto.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Meta verification handshake.
 * Meta calls this once when the webhook subscription is created.
 * We echo `hub.challenge` iff `hub.verify_token` matches our secret.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.META_WEBHOOK_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "verification failed" }, { status: 403 });
}

/**
 * Real-time lead event.
 * Body shape (per Meta docs):
 * {
 *   object: "page",
 *   entry: [
 *     { id: "<page_id>", time: 123, changes: [
 *       { field: "leadgen", value: { leadgen_id, form_id, page_id, created_time, ad_id } }
 *     ] }
 *   ]
 * }
 */
export async function POST(req: NextRequest) {
  // Verify HMAC over the RAW body (must not JSON.parse before verification).
  const raw = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  if (!verifyMetaSignature(raw, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 403 });
  }

  let payload: unknown;
  try { payload = JSON.parse(raw); }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  // Collect all leadgen changes
  interface Change { field: string; value: { leadgen_id: string; form_id: string; page_id: string; created_time?: number } }
  interface Entry   { id: string; changes?: Change[] }
  const entries = (payload as { entry?: Entry[] })?.entry ?? [];

  const changes: Change[] = [];
  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      if (change.field === "leadgen" && change.value?.leadgen_id) changes.push(change);
    }
  }

  // Respond to Meta immediately after fanning out the work.
  // Meta expects a 2xx within a few seconds; retries on non-2xx.
  const work = changes.map(async (c) => {
    const { leadgen_id, form_id, page_id, created_time } = c.value;
    const iso = created_time ? new Date(created_time * 1000).toISOString() : undefined;

    const tenant = await resolveFormTenant(form_id);
    if (!tenant) {
      // Form isn't registered — log a raw row anyway so we can see it in the log.
      // Use tenant_id = null-ish? RLS on meta_leads_raw requires tenant_id, so skip.
      return;
    }
    await recordReceivedEvent(tenant.tenant_id, leadgen_id, form_id, page_id, iso);
    await ingestMetaLead(leadgen_id, form_id, page_id, iso);
  });

  // Await so failures surface in Vercel logs; still fits inside maxDuration for typical volumes.
  await Promise.allSettled(work);

  return NextResponse.json({ received: changes.length });
}
