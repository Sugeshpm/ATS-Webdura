import Link from "next/link";
import { Zap, Linkedin, Briefcase } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { BackToSettings } from "@/components/settings/back-link";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const supabase = await createClient();
  const [{ count: metaFormsCount }, { count: metaLeadsCount }] = await Promise.all([
    supabase.from("meta_lead_forms").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("meta_leads_raw").select("id", { count: "exact", head: true })
  ]);

  const catalog = [
    {
      key: "meta",
      href: "/settings/integrations/meta",
      title: "Meta Lead Ads",
      subtitle: "Facebook + Instagram Lead Gen forms",
      icon: Zap,
      tone: "hsl(217 91% 60%)",
      available: true,
      stats: `${metaFormsCount ?? 0} form${(metaFormsCount ?? 0) === 1 ? "" : "s"} · ${metaLeadsCount ?? 0} lead${(metaLeadsCount ?? 0) === 1 ? "" : "s"}`
    },
    {
      key: "linkedin",
      href: "#",
      title: "LinkedIn Recruiter",
      subtitle: "Sync candidates from LinkedIn Recruiter Lite",
      icon: Linkedin,
      tone: "hsl(210 100% 40%)",
      available: false,
      stats: "Coming in Phase 3"
    },
    {
      key: "naukri",
      href: "#",
      title: "Naukri.com",
      subtitle: "Push jobs to Naukri; pull applicants back",
      icon: Briefcase,
      tone: "hsl(15 90% 50%)",
      available: false,
      stats: "Coming in Phase 3"
    }
  ];

  return (
    <div className="container max-w-5xl py-8">
      <BackToSettings />
      <h1 className="text-xl font-semibold">Integrations</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Connect external sources to auto-ingest candidates into your pipeline.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {catalog.map((c) => {
          const Icon = c.icon;
          const inner = (
            <article className={
              "flex h-full flex-col rounded-xl border border-border bg-card p-5 shadow-card transition-all " +
              (c.available ? "hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-card-hover" : "opacity-60")
            }>
              <div className="flex items-start justify-between">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ background: `color-mix(in srgb, ${c.tone} 15%, transparent)`, color: c.tone }}
                >
                  <Icon className="h-5 w-5" />
                </span>
                {c.available
                  ? (metaFormsCount ?? 0) > 0
                    ? <Badge variant="success">Connected</Badge>
                    : <Badge variant="muted">Not connected</Badge>
                  : <Badge variant="muted">Coming soon</Badge>}
              </div>
              <h2 className="mt-3 text-sm font-semibold">{c.title}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{c.subtitle}</p>
              <p className="mt-4 text-[11px] text-muted-foreground">{c.stats}</p>
            </article>
          );
          return c.available ? <Link key={c.key} href={c.href}>{inner}</Link> : <div key={c.key}>{inner}</div>;
        })}
      </div>
    </div>
  );
}
