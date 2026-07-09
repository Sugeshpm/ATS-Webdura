import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const [
    { data: tenant },
    { count: deptCount },
    { count: locCount },
    { count: stageCount },
    { count: userCount },
    { count: tplCount },
    { count: metaFormsCount }
  ] = await Promise.all([
    supabase.from("tenants").select("name, slug, time_zone").single(),
    supabase.from("departments").select("id", { count: "exact", head: true }).eq("is_archived", false),
    supabase.from("locations").select("id", { count: "exact", head: true }).eq("is_archived", false),
    supabase.from("stages").select("id", { count: "exact", head: true }).eq("is_archived", false),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("templates").select("id", { count: "exact", head: true }),
    supabase.from("meta_lead_forms").select("id", { count: "exact", head: true }).eq("is_active", true)
  ]);

  const cards = [
    { href: "/settings/organisation", title: "Organisation",  desc: `Name, logo, brand. Current: ${tenant?.name ?? "—"}` },
    { href: "/settings/users",        title: "Users & roles", desc: `${userCount ?? 0} member${userCount === 1 ? "" : "s"}` },
    { href: "/settings/departments",  title: "Departments",   desc: `${deptCount ?? 0} department${deptCount === 1 ? "" : "s"}` },
    { href: "/settings/locations",    title: "Locations",     desc: `${locCount ?? 0} location${locCount === 1 ? "" : "s"}` },
    { href: "/settings/stages",       title: "Pipeline stages", desc: `${stageCount ?? 0} active stage${stageCount === 1 ? "" : "s"}` },
    { href: "/settings/templates",    title: "Templates",     desc: `${tplCount ?? 0} template${tplCount === 1 ? "" : "s"} — email, WhatsApp, offer letter, scorecards` },
    { href: "/settings/integrations", title: "Integrations",  desc: `Meta Lead Ads · ${metaFormsCount ?? 0} form${(metaFormsCount ?? 0) === 1 ? "" : "s"} connected` }
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
