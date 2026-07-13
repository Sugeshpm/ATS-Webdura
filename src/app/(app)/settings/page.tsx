import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();

  // Any query that hits a table which might not exist yet (e.g. the auth-allowlist
  // migration hasn't been applied) is wrapped so its rejection doesn't nuke the whole page.
  const safeCount = async (p: PromiseLike<{ count: number | null }>) => {
    try { const r = await p; return r.count ?? 0; } catch { return 0; }
  };
  const safeSingle = async <T,>(p: PromiseLike<{ data: T | null }>) => {
    try { const r = await p; return r.data; } catch { return null; }
  };

  const [
    tenant,
    deptCount, locCount, stageCount, userCount, tplCount, metaFormsCount,
    allowedDomainsCount, whitelistCount
  ] = await Promise.all([
    safeSingle(supabase.from("tenants").select("name, slug, time_zone").single()),
    safeCount(supabase.from("departments").select("id", { count: "exact", head: true }).eq("is_archived", false)),
    safeCount(supabase.from("locations").select("id", { count: "exact", head: true }).eq("is_archived", false)),
    safeCount(supabase.from("stages").select("id", { count: "exact", head: true }).eq("is_archived", false)),
    safeCount(supabase.from("profiles").select("id", { count: "exact", head: true })),
    safeCount(supabase.from("templates").select("id", { count: "exact", head: true })),
    safeCount(supabase.from("meta_lead_forms").select("id", { count: "exact", head: true }).eq("is_active", true)),
    safeCount(supabase.from("auth_allowed_domains").select("domain", { count: "exact", head: true })),
    safeCount(supabase.from("auth_email_whitelist").select("email", { count: "exact", head: true }))
  ]);

  const cards = [
    { href: "/settings/organisation", title: "Organisation",  desc: `Name, logo, brand. Current: ${(tenant as { name?: string } | null)?.name ?? "—"}` },
    { href: "/settings/users",        title: "Users & roles", desc: `${userCount} member${userCount === 1 ? "" : "s"}` },
    { href: "/settings/access",       title: "Access control", desc: `${allowedDomainsCount} domain${allowedDomainsCount === 1 ? "" : "s"}, ${whitelistCount} whitelisted email${whitelistCount === 1 ? "" : "s"}` },
    { href: "/settings/departments",  title: "Departments",   desc: `${deptCount} department${deptCount === 1 ? "" : "s"}` },
    { href: "/settings/locations",    title: "Locations",     desc: `${locCount} location${locCount === 1 ? "" : "s"}` },
    { href: "/settings/stages",       title: "Pipeline stages", desc: `${stageCount} active stage${stageCount === 1 ? "" : "s"}` },
    { href: "/settings/templates",    title: "Templates",     desc: `${tplCount} template${tplCount === 1 ? "" : "s"} — email, WhatsApp, offer letter, scorecards` },
    { href: "/settings/integrations", title: "Integrations",  desc: `Meta Lead Ads · ${metaFormsCount} form${metaFormsCount === 1 ? "" : "s"} connected` }
  ];

  return (
    <div className="container py-8">
      <h1 className="text-xl font-semibold">Settings</h1>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.href} href={c.href}>
            <Card className="transition-colors hover:bg-secondary/30">
              <CardHeader>
                <CardTitle className="text-base">{c.title}</CardTitle>
                <CardDescription>{c.desc}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
