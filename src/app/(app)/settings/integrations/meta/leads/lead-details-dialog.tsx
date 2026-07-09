"use client";
import * as React from "react";
import { Eye } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface FieldDatum { name?: string; values?: string[] }
interface RawPayload {
  field_data?: FieldDatum[];
  created_time?: string;
  ad_name?: string;
  campaign_name?: string;
  platform?: string;
  pending?: boolean;
  error?: string;
  [k: string]: unknown;
}

export interface LeadRow {
  leadgen_id: string;
  form_id: string;
  page_id: string;
  received_at: string;
  meta_created_time: string | null;
  status: string;
  error: string | null;
  raw_payload: RawPayload | null;
}

export function LeadDetailsDialog({ lead }: { lead: LeadRow }) {
  const [open, setOpen] = React.useState(false);
  const payload = lead.raw_payload ?? {};
  const fields = Array.isArray(payload.field_data) ? payload.field_data : [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-xs" title="View submitted answers">
          <Eye className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Lead details</DialogTitle>
          <DialogDescription>Everything Meta sent for this submission — including unmapped custom questions.</DialogDescription>
        </DialogHeader>

        {/* Metadata */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          <Meta label="Status"><StatusText status={lead.status} /></Meta>
          <Meta label="Received">{new Date(lead.received_at).toLocaleString()}</Meta>
          <Meta label="Submitted on Meta">
            {lead.meta_created_time ? new Date(lead.meta_created_time).toLocaleString() : "—"}
          </Meta>
          <Meta label="Platform">{payload.platform ?? "—"}</Meta>
          <Meta label="Campaign">{payload.campaign_name ?? "—"}</Meta>
          <Meta label="Ad">{payload.ad_name ?? "—"}</Meta>
          <Meta label="Leadgen ID"><span className="font-mono break-all">{lead.leadgen_id}</span></Meta>
          <Meta label="Form ID"><span className="font-mono break-all">{lead.form_id}</span></Meta>
        </dl>

        {lead.error && (
          <div className="rounded-md border border-rose-300 bg-rose-50 p-2.5 text-xs text-rose-800">
            <span className="font-semibold">Error: </span>{lead.error}
          </div>
        )}

        {/* Submitted answers */}
        {fields.length > 0 ? (
          <div className="max-h-[45vh] overflow-y-auto rounded-lg border border-border">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-surface-sunken text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Question</th>
                  <th className="px-3 py-2 text-left">Answer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {fields.map((f, i) => (
                  <tr key={`${f.name ?? "field"}-${i}`}>
                    <td className="px-3 py-2 align-top font-mono text-xs text-muted-foreground">{f.name ?? "—"}</td>
                    <td className="px-3 py-2">{(f.values ?? []).filter(Boolean).join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {payload.pending ? "This lead is still being processed — no payload captured yet." : "No field data on this payload."}
          </p>
        )}

        {/* Raw JSON escape hatch */}
        <details className="rounded-md border border-border">
          <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-muted-foreground">Raw JSON</summary>
          <pre className="max-h-[40vh] overflow-auto border-t border-border bg-secondary/30 p-3 text-[11px] leading-relaxed">
            {JSON.stringify(lead.raw_payload ?? {}, null, 2)}
          </pre>
        </details>
      </DialogContent>
    </Dialog>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{children}</dd>
    </div>
  );
}

function StatusText({ status }: { status: string }) {
  const variant =
    status === "inserted" ? "success" :
    status === "failed" ? "danger" :
    status === "duplicate" ? "info" :
    status === "received" ? "warning" : "muted";
  return <Badge variant={variant as "success" | "danger" | "info" | "warning" | "muted"}>{status}</Badge>;
}
