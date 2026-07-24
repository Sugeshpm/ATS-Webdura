import { createClient } from "@/lib/supabase/server";
import { evaluateApplication } from "@/lib/ai/shortlist";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request, ctx: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = await ctx.params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json(401, { ok: false, error: "Not signed in." });

  // Simple auth: this route is scoped to the caller's tenant via RLS on the
  // downstream tables; we just make sure they're logged in and let the DB
  // enforce access.
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  const result = await evaluateApplication(applicationId, { force }, user.id);
  return json(result.status === "error" ? 422 : 200, result);
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" }
  });
}
