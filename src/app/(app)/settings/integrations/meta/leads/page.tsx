import Link from "next/link";
import { CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { BackToSettings } from "@/components/settings/back-link";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_FILTERS = ["all", "inserted", "duplicate", "failed", "received"] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

export default async function MetaLeadsLogPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string; form_id?: string }>;
}) {
  const params = await searchParams;
  const status = (STATUS_FILTERS as readonly string[]).includes(params.status ?? "") ? (params.status as StatusFilter) : "all";
  const supabase = await createClient();

  let q = supabase
    .from("meta_leads_raw")
    .select(`
      id, leadgen_id, form_id, page_id, received_at, meta_created_time, status, error,
      candidate:candidates ( id, first_name, last_name, email )
    `)
    .order("received_at", { ascending: false })
    .limit(200);
  if (status !== "all") q = q.eq("status", status);
  if (params.form_id) q = q.eq("form_id", params.form_id);

  const { data: leads } = await q;

  const [{ count: all }, { count: inserted }, { count: duplicate }, { count: failed }, { count: received }] = await Promise.all([
    supabase.from("meta_leads_raw").select("id", { count: "exact", head: true }),
    supabase.from("meta_leads_raw").select("id", { count: "exact", head: true }).eq("status", "inserted"),
    supabase.from("meta_leads_raw").select("id", { count: "exact", head: true }).eq("status", "duplicate"),
    supabase.from("meta_leads_raw").select("id", { count: "exact", head: true }).eq("status", "failed"),
    supabase.from("meta_leads_raw").select("id", { count: "exact", head: true }).eq("status", "received")
  ]);
  const counts: Record<StatusFilter, number> = {
    all: all ?? 0, inserted: inserted ?? 0, duplicate: duplicate ?? 0, failed: failed ?? 0, received: received ?? 0
  };

  return (
    <div className="container max-w-6xl py-8">
      <BackToSettings />
      <h1 className="text-xl font-semibold">Meta leads log</h1>
      <p className="mt-1 text-sm text-muted-foreground">Every lead ever received from Meta, mapped to its candidate row (if ingest succeeded).</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <Link
            key={s}
            href={s === "all" ? "/settings/integrations/meta/leads" : `/settings/integrations/meta/leads?status=${s}`}
            className={`rounded-full border px-3 py-1 text-xs ${status === s ? "border-primary text-primary" : "border-border text-muted-foreground hover:border-foreground/30"}`}
          >
            {s} <span className="ml-1 opacity-60">{counts[s]}</span>
          </Link>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-sunken text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Received</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Candidate</th>
              <th className="px-4 py-3 text-left">Form</th>
              <th className="px-4 py-3 text-left">Leadgen ID</th>
              <th className="px-4 py-3 text-left">Error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(leads ?? []).map((l: any) => (
              <tr key={l.id}>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {formatDate(l.received_at, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-4 py-2.5"><StatusBadge status={l.status} /></td>
                <td className="px-4 py-2.5">
                  {l.candidate ? (
                    <div>
                      <div className="text-sm font-medium">{l.candidate.first_name} {l.candidate.last_name ?? ""}</div>
                      {l.candidate.email && <div className="text-[11px] text-muted-foreground">{l.candidate.email}</div>}
                    </div>
                  ) : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">{l.form_id}</td>
                <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">{l.leadgen_id}</td>
                <td className="px-4 py-2.5 text-xs text-rose-600">{l.error ?? ""}</td>
              </tr>
            ))}
            {(!leads || leads.length === 0) && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">No leads in this view.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">Showing at most 200 rows. Add a date filter if you need more.</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "inserted") return <Badge variant="success"><CheckCircle2 className="mr-1 h-3 w-3" /> Inserted</Badge>;
  if (status === "duplicate") return <Badge variant="info">Duplicate</Badge>;
  if (status === "failed") return <Badge variant="danger"><XCircle className="mr-1 h-3 w-3" /> Failed</Badge>;
  if (status === "received") return <Badge variant="warning"><Clock className="mr-1 h-3 w-3" /> Received</Badge>;
  if (status === "mapped") return <Badge variant="info"><AlertTriangle className="mr-1 h-3 w-3" /> Mapped</Badge>;
  return <Badge variant="muted">{status}</Badge>;
}
