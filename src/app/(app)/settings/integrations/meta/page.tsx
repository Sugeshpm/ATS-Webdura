import Link from "next/link";
import { Info, ExternalLink, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { BackToSettings } from "@/components/settings/back-link";
import { verifyMetaToken } from "./actions";

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
  const appSecretSet = !!process.env.META_APP_SECRET;
  const encKeySet = !!process.env.META_ENCRYPTION_KEY;

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

      {/* Setup checklist */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base inline-flex items-center gap-2"><Info className="h-4 w-4" /> Setup checklist</CardTitle>
          <CardDescription>Complete these before pointing Meta at us.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <ChecklistRow ok={appIdSet}>
              <code>META_APP_ID</code> set in environment
            </ChecklistRow>
            <ChecklistRow ok={appSecretSet}>
              <code>META_APP_SECRET</code> set (used to verify webhook signatures)
            </ChecklistRow>
            <ChecklistRow ok={!!process.env.META_WEBHOOK_VERIFY_TOKEN}>
              <code>META_WEBHOOK_VERIFY_TOKEN</code> set (Meta echoes this during handshake)
            </ChecklistRow>
            <ChecklistRow ok={encKeySet}>
              <code>META_ENCRYPTION_KEY</code> set (32-byte hex — encrypts Page tokens at rest)
            </ChecklistRow>
            <ChecklistRow ok={true}>
              Webhook subscribed at{" "}
              <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                developers.facebook.com → Your App → Webhooks → Page → leadgen
              </a>
            </ChecklistRow>
          </ul>
        </CardContent>
      </Card>

      {/* Webhook config */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Webhook endpoint</CardTitle>
          <CardDescription>Paste these into Meta&apos;s Webhook configuration for your app.</CardDescription>
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

      {/* Connect a page */}
      <Card className="mt-4">
        <form action={verifyMetaToken}>
          <CardHeader>
            <CardTitle className="text-base">Connect a Facebook Page</CardTitle>
            <CardDescription>
              Paste a long-lived Page Access Token from the{" "}
              <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
                Graph API Explorer <ExternalLink className="h-3 w-3" />
              </a>. The token stays encrypted at rest.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="page_id">Page ID *</Label>
              <Input id="page_id" name="page_id" required placeholder="123456789012345" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="token">Page Access Token *</Label>
              <Input id="token" name="token" type="password" required placeholder="EAAG…" autoComplete="off" />
              <p className="text-[11px] text-muted-foreground">
                Must have <code>leads_retrieval</code> + <code>pages_show_list</code> + <code>pages_manage_ads</code> permissions.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="submit">Verify &amp; continue</Button>
          </CardFooter>
        </form>
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

function ChecklistRow({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className={"mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold " + (ok ? "bg-emerald-500 text-white" : "bg-amber-400 text-white")}>
        {ok ? "✓" : "!"}
      </span>
      <span>{children}</span>
    </li>
  );
}
