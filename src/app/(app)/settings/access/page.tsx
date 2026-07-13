import { Trash2, Globe, MailPlus, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BackToSettings } from "@/components/settings/back-link";
import { formatDate } from "@/lib/utils";
import {
  addAllowedDomain, removeAllowedDomain,
  addEmailToWhitelist, removeEmailFromWhitelist
} from "./actions";

export const dynamic = "force-dynamic";

interface DomainRow { domain: string; reason: string | null; created_at: string }
interface EmailRow  { email: string; reason: string | null; created_at: string }

export default async function AccessControlPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const params = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const isSuperAdmin = (me as { role: string } | null)?.role === "super_admin";
  if (!isSuperAdmin) redirect("/settings?error=forbidden");

  const [{ data: domains }, { data: emails }] = await Promise.all([
    supabase.from("auth_allowed_domains").select("domain, reason, created_at").order("domain"),
    supabase.from("auth_email_whitelist").select("email, reason, created_at").order("email")
  ]);

  return (
    <div className="container py-8">
      <BackToSettings />
      <h1 className="text-xl font-semibold">Access control</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Only allowed domains and whitelisted emails can create an account (email/password or Google).
        Existing accounts are unaffected — they can keep signing in until you disable them individually.
      </p>

      {params.error && (
        <div className="mt-4 rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
          {decodeURIComponent(params.error)}
        </div>
      )}
      {params.ok && (
        <div className="mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          {params.ok === "domain_added" ? "Domain added to the allowlist." : "Email added to the whitelist."}
        </div>
      )}

      {/* ============ Domains ============ */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2 text-base">
            <Globe className="h-4 w-4" /> Allowed domains
          </CardTitle>
          <CardDescription>Anyone with an email at these domains can sign up (still needs approval).</CardDescription>
        </CardHeader>
        <form action={addAllowedDomain}>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="domain">Domain</Label>
              <Input id="domain" name="domain" placeholder="example.com" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Input id="reason" name="reason" placeholder="e.g. Acquired subsidiary" />
            </div>
            <Button type="submit" className="sm:mb-0">Add domain</Button>
          </CardContent>
        </form>
        <CardFooter className="flex flex-col items-stretch gap-0 border-t border-border p-0">
          {(domains as DomainRow[] | null)?.length ? (
            <ul className="divide-y divide-border">
              {(domains as DomainRow[]).map((d) => (
                <li key={d.domain} className="flex items-center justify-between gap-3 px-6 py-3">
                  <div className="min-w-0">
                    <div className="font-medium">@{d.domain}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.reason ? d.reason : "No reason provided"} · added {formatDate(d.created_at)}
                    </div>
                  </div>
                  <form action={async () => { "use server"; await removeAllowedDomain(d.domain); }}>
                    <Button size="sm" variant="ghost" type="submit" className="text-xs">
                      <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-6 py-6 text-center text-sm text-muted-foreground">No domains allowed. Nobody can self-register.</div>
          )}
        </CardFooter>
      </Card>

      {/* ============ Whitelist ============ */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2 text-base">
            <MailPlus className="h-4 w-4" /> Whitelisted emails
          </CardTitle>
          <CardDescription>Specific external addresses that can sign up even when their domain isn&apos;t allowed.</CardDescription>
        </CardHeader>
        <form action={addEmailToWhitelist}>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="contractor@example.com" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Input id="reason" name="reason" placeholder="e.g. External recruiter, Q3-2026 contract" />
            </div>
            <Button type="submit"><ShieldCheck className="mr-1 h-4 w-4" /> Whitelist</Button>
          </CardContent>
        </form>
        <CardFooter className="flex flex-col items-stretch gap-0 border-t border-border p-0">
          {(emails as EmailRow[] | null)?.length ? (
            <ul className="divide-y divide-border">
              {(emails as EmailRow[]).map((e) => (
                <li key={e.email} className="flex items-center justify-between gap-3 px-6 py-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{e.email}</div>
                    <div className="text-xs text-muted-foreground">
                      {e.reason ? e.reason : "No reason provided"} · added {formatDate(e.created_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">External</Badge>
                    <form action={async () => { "use server"; await removeEmailFromWhitelist(e.email); }}>
                      <Button size="sm" variant="ghost" type="submit" className="text-xs">
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-6 py-6 text-center text-sm text-muted-foreground">
              No whitelisted emails. Only allowed-domain addresses can register.
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
