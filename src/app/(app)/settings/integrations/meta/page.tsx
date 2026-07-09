import Link from "next/link";
import { ArrowRight, Facebook } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { BackToSettings } from "@/components/settings/back-link";

export const dynamic = "force-dynamic";

export default async function MetaIntegrationPage({
  searchParams
}: {
  searchParams: Promise<{ msg?: string; token_verified?: string; page_id?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: forms } = await supabase
    .from("meta_lead_forms")
    .select("id, page_id, page_name, form_id, form_name, is_active")
    .order("created_at", { ascending: false });

  const distinctPages = new Map<string, string | null>();
  for (const f of (forms ?? []) as { page_id: string; page_name: string | null }[]) {
    distinctPages.set(f.page_id, f.page_name);
  }

  const webhookUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/integrations/meta/webhook`;
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN
    ? "•".repeat(20) + " (set in env)"
    : "⚠ META_WEBHOOK_VERIFY_TOKEN not set";
  const appIdSet = !!process.env.META_APP_ID;

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
