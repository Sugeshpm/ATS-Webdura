import Link from "next/link";
import { ArrowRight, Facebook, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { BackToSettings } from "@/components/settings/back-link";
import { decrypt } from "@/lib/crypto/encrypt";
import { isPageSubscribedToLeadgen } from "@/lib/meta/graph";

export const dynamic = "force-dynamic";

interface PageStatus { pageId: string; pageName: string | null; subscribed: boolean | null; error: string | null }

export default async function MetaIntegrationPage({
  searchParams
}: {
  searchParams: Promise<{ msg?: string; token_verified?: string; page_id?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: forms } = await supabase
    .from("meta_lead_forms")
    .select("id, page_id, page_name, form_id, form_name, is_active, page_access_token_encrypted")
    .order("created_at", { ascending: false });

  const distinctPages = new Map<string, string | null>();
  const pageTokens = new Map<string, string>();
  for (const f of (forms ?? []) as { page_id: string; page_name: string | null; page_access_token_encrypted: string | null }[]) {
    distinctPages.set(f.page_id, f.page_name);
    if (f.page_access_token_encrypted && !pageTokens.has(f.page_id)) pageTokens.set(f.page_id, f.page_access_token_encrypted);
  }

  const webhookUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/integrations/meta/webhook`;
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN
    ? "•".repeat(20) + " (set in env)"
    : "⚠ META_WEBHOOK_VERIFY_TOKEN not set";
  const appIdSet = !!process.env.META_APP_ID;
  const appSecretSet = !!process.env.META_APP_SECRET;
  const verifyTokenSet = !!process.env.META_WEBHOOK_VERIFY_TOKEN;

  // Live check: is each connected Page actually subscribed to our webhook for leadgen?
  const pageStatuses: PageStatus[] = await Promise.all(
    Array.from(pageTokens.entries()).map(async ([pageId, enc]) => {
      try {
        const subscribed = await isPageSubscribedToLeadgen(decrypt(enc), pageId);
        return { pageId, pageName: distinctPages.get(pageId) ?? null, subscribed, error: null };
      } catch (e) {
        return { pageId, pageName: distinctPages.get(pageId) ?? null, subscribed: null, error: (e as Error).message };
      }
    })
  );

  // Webhook activity in the last 7 days (any received lead is evidence the webhook is delivering).
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: recentLeads } = await supabase
    .from("meta_leads_raw")
    .select("id", { count: "exact", head: true })
    .gte("received_at", since);

  const [status, msg] = params.msg?.split(":") ?? [];

  return (
    <div className="container max-w-3xl py-8">
      <BackToSettings />
      <h1 className="text-xl font-semibold">Meta Lead Ads</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Real-time sync of Facebook + Instagram Lead Gen form submissions into your candidate pipeline.
      </p>

      {msg && (
        <div className={`mt-4 rounded-md border p-3 text-sm ${
          status === "success" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-rose-300 bg-rose-50 text-rose-800"
        }`}>{decodeURIComponent(msg)}</div>
      )}

      {/* Primary: Facebook Login connect flow */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base inline-flex items-center gap-2">
            <Facebook className="h-4 w-4 text-[#1877F2]" /> Connect with Facebook
          </CardTitle>
          <CardDescription>
            Log in with Facebook, then pick your Page and the Lead Gen form to sync. We fetch Pages and forms
            automatically — no IDs or tokens to copy by hand.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {appIdSet ? (
            <Button asChild>
              <a href="/api/integrations/meta/oauth/start">
                <Facebook className="mr-1 h-4 w-4" /> Continue with Facebook
              </a>
            </Button>
          ) : (
            <p className="text-sm text-amber-700">
              Set <code>META_APP_ID</code> and <code>META_APP_SECRET</code> in the environment to enable Facebook login.
            </p>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            Redirect URI to whitelist in your Meta app (Facebook Login → Settings → Valid OAuth Redirect URIs):{" "}
            <code className="break-all">{`${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/integrations/meta/oauth/callback`}</code>
          </p>
        </CardContent>
      </Card>

      {/* Real-time delivery diagnostics */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Real-time delivery status</CardTitle>
          <CardDescription>Live check of why leads may or may not be arriving automatically.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {/* Environment */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Environment (Vercel)</div>
            <StatusLine ok={appIdSet} label="META_APP_ID set" />
            <StatusLine ok={appSecretSet} label="META_APP_SECRET set (verifies webhook signature)" bad="Webhook POSTs are rejected (403) without this." />
            <StatusLine ok={verifyTokenSet} label="META_WEBHOOK_VERIFY_TOKEN set (handshake)" bad="Meta's webhook verification fails without this." />
          </div>

          {/* Page subscriptions */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Page → app subscription (leadgen)</div>
            {pageStatuses.length === 0 ? (
              <p className="text-xs text-muted-foreground">No connected Pages yet.</p>
            ) : (
              pageStatuses.map((p) => (
                <div key={p.pageId} className="flex items-start gap-2">
                  {p.subscribed === true
                    ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    : p.subscribed === false
                      ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                      : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />}
                  <div>
                    <div>{p.pageName ?? p.pageId} —{" "}
                      {p.subscribed === true ? <span className="text-emerald-600">subscribed</span>
                        : p.subscribed === false ? <span className="text-rose-600">NOT subscribed</span>
                        : <span className="text-amber-600">couldn&apos;t verify</span>}
                    </div>
                    {p.subscribed === false && (
                      <div className="text-[11px] text-muted-foreground">Click <strong>Continue with Facebook</strong> → <strong>Enable real-time</strong> for this Page.</div>
                    )}
                    {p.error && <div className="text-[11px] text-muted-foreground">{p.error} — reconnect with Facebook to refresh the token/permission.</div>}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Activity */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Webhook activity</div>
            <StatusLine ok={(recentLeads ?? 0) > 0} label={`${recentLeads ?? 0} lead${(recentLeads ?? 0) === 1 ? "" : "s"} received in the last 7 days`} neutral />
          </div>

          <div className="rounded-md border border-amber-300 bg-amber-50 p-2.5 text-[11px] text-amber-800">
            Even when a Page shows <strong>subscribed</strong>, real-time delivery also needs the <strong>app-level webhook</strong>
            configured in your Meta App dashboard → Webhooks → Page → subscribe to <code>leadgen</code>, using the Callback URL
            and Verify token below.
          </div>
        </CardContent>
      </Card>

      {/* Webhook config — one-time setup, required for real-time lead delivery */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Webhook endpoint</CardTitle>
          <CardDescription>
            One-time setup for real-time delivery. Paste these into your Meta app&apos;s Webhooks config (Page → leadgen).
            Without it, connected forms only ingest when you press &quot;Sync now&quot;.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <Label>Callback URL</Label>
            <div className="mt-1 rounded-md border border-border bg-secondary/40 p-2 font-mono text-xs break-all">{webhookUrl}</div>
          </div>
          <div>
            <Label>Verify token</Label>
            <div className="mt-1 rounded-md border border-border bg-secondary/40 p-2 font-mono text-xs">{verifyToken}</div>
          </div>
          <div>
            <Label>Subscribe to</Label>
            <div className="mt-1 text-xs">
              <Badge variant="info">page → leadgen</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connected pages */}
      {distinctPages.size > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Connected pages</CardTitle>
            <CardDescription>{distinctPages.size} Facebook page{distinctPages.size === 1 ? "" : "s"} connected.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {Array.from(distinctPages.entries()).map(([pageId, pageName]) => (
                <li key={pageId} className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm font-medium">{pageName ?? "Unnamed page"}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">{pageId}</div>
                  </div>
                  <Link href={`/settings/integrations/meta/forms?page_id=${pageId}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    Manage forms <ArrowRight className="h-3 w-3" />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <Link href="/settings/integrations/meta/forms" className="text-sm text-primary hover:underline">
          → Registered forms
        </Link>
        <Link href="/settings/integrations/meta/leads" className="text-sm text-primary hover:underline">
          → Ingested leads log
        </Link>
      </div>
    </div>
  );
}

function StatusLine({ ok, label, bad, neutral }: { ok: boolean; label: string; bad?: string; neutral?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      {ok
        ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
        : neutral
          ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />}
      <div>
        <span className={ok ? "" : "text-foreground"}>{label}</span>
        {!ok && bad && <div className="text-[11px] text-rose-600">{bad}</div>}
      </div>
    </div>
  );
}
