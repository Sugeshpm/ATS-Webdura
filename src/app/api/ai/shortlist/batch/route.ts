import { createClient } from "@/lib/supabase/server";
import { evaluateApplication } from "@/lib/ai/shortlist";

export const dynamic = "force-dynamic";
export const maxDuration = 300;   // Vercel Pro cap; hobby will use 60s

const MAX_BATCH = 500;
const CONCURRENCY = 5;

/**
 * Bulk-evaluate a set of applications. Streams NDJSON — one JSON object per
 * completed evaluation, exactly like the CSV import route so the client-side
 * progress UI works with the same parser.
 *
 * Body:  { application_ids: string[], force?: boolean }
 * Stream shape:
 *   { type: "start", total: N }
 *   { type: "row", application_id, status, score?, verdict?, error? }
 *   { type: "done", total, shortlisted, borderline, not_shortlisted, no_resume, errors, cost_usd }
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401 });

  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body?.application_ids) ? (body.application_ids as string[]) : [];
  const force = Boolean(body?.force);
  if (!ids.length) return new Response(JSON.stringify({ error: "application_ids is required." }), { status: 400 });
  if (ids.length > MAX_BATCH) return new Response(JSON.stringify({ error: `Max batch size is ${MAX_BATCH}.` }), { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      emit({ type: "start", total: ids.length });

      const counters = { shortlisted: 0, borderline: 0, not_shortlisted: 0, no_resume: 0, errors: 0, cost: 0 };

      // Run in fixed-concurrency waves so we don't blast the Anthropic API.
      for (let i = 0; i < ids.length; i += CONCURRENCY) {
        const wave = ids.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
          wave.map((id) =>
            evaluateApplication(id, { force }, user.id).catch((e) => ({
              application_id: id,
              status: "error" as const,
              error: e instanceof Error ? e.message : String(e)
            }))
          )
        );
        for (const r of results) {
          if (r.status === "error") counters.errors++;
          else if (r.verdict === "shortlisted") counters.shortlisted++;
          else if (r.verdict === "borderline") counters.borderline++;
          else if (r.verdict === "not_shortlisted") counters.not_shortlisted++;
          else if (r.verdict === "no_resume") counters.no_resume++;
          counters.cost += r.cost_usd ?? 0;
          emit({
            type: "row",
            application_id: r.application_id,
            status: r.status,
            score: r.score,
            verdict: r.verdict,
            error: r.error
          });
        }
      }

      emit({
        type: "done",
        total: ids.length,
        shortlisted: counters.shortlisted,
        borderline: counters.borderline,
        not_shortlisted: counters.not_shortlisted,
        no_resume: counters.no_resume,
        errors: counters.errors,
        cost_usd: Math.round(counters.cost * 10000) / 10000
      });
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Accel-Buffering": "no"
    }
  });
}
