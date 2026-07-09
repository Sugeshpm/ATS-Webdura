import Link from "next/link";
import { RefreshCw, Trash2, Power } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BackToSettings } from "@/components/settings/back-link";
import { updateMetaFormJob, toggleMetaFormActive, deleteMetaForm } from "../actions";
import { RegisterFormDialog } from "./register-form-dialog";
import { SyncNowButton } from "./sync-now-button";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MetaFormsPage({
  searchParams
}: {
  searchParams: Promise<{ page_id?: string; msg?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const [{ data: forms }, { data: jobs }] = await Promise.all([
    supabase
      .from("meta_lead_forms")
      .select("id, page_id, page_name, form_id, form_name, job_id, is_active, last_synced_at, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("jobs").select("id, title").eq("status", "active").order("title")
  ]);

  const distinctPages = new Map<string, string | null>();
  for (const f of (forms ?? []) as { page_id: string; page_name: string | null }[]) {
    distinctPages.set(f.page_id, f.page_name);
  }

  const [status, msg] = params.msg?.split(":") ?? [];

  return (
    <div className="container max-w-5xl py-8">
      <BackToSettings />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Meta Lead Ad forms</h1>
          <p className="mt-1 text-sm text-muted-foreground">Registered forms sync new submissions into your candidate pipeline in real time.</p>
        </div>
        <RegisterFormDialog
          jobs={(jobs ?? []) as { id: string; title: string }[]}
          knownPages={Array.from(distinctPages.entries()).map(([id, name]) => ({ id, name }))}
        />
      </div>

      {msg && (
        <div className={`mt-4 rounded-md border p-3 text-sm ${
          status === "success" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-rose-300 bg-rose-50 text-rose-800"
        }`}>{decodeURIComponent(msg)}</div>
      )}

      {(!forms || forms.length === 0) ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">No forms registered yet</CardTitle>
            <CardDescription>
              Add a form to start receiving leads. You&apos;ll need a Page Access Token and the form ID from Meta&apos;s Ad Manager.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/settings/integrations/meta" className="text-sm text-primary hover:underline">← Back to Meta setup</Link>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card shadow-card">
          <table className="min-w-full text-sm">
            <thead className="bg-surface-sunken text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Form</th>
                <th className="px-4 py-3 text-left">Page</th>
                <th className="px-4 py-3 text-left">Applies to job</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Last synced</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(forms as never as Array<{
                id: string; page_id: string; page_name: string | null; form_id: string; form_name: string | null;
                job_id: string | null; is_active: boolean; last_synced_at: string | null;
              }>).map((f) => (
                <tr key={f.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{f.form_name ?? f.form_id}</div>
                    <div className="text-[11px] font-mono text-muted-foreground">{f.form_id}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs">{f.page_name ?? "—"}</div>
                    <div className="text-[11px] font-mono text-muted-foreground">{f.page_id}</div>
                  </td>
                  <td className="px-4 py-3">
                    <form action={updateMetaFormJob} className="inline-flex">
                      <input type="hidden" name="id" value={f.id} />
                      <select
                        name="job_id"
                        defaultValue={f.job_id ?? ""}
                        onChange={(e) => (e.currentTarget.form as HTMLFormElement).requestSubmit()}
                        className="h-8 max-w-[200px] rounded-md border border-input bg-white px-2 text-xs"
                      >
                        <option value="">— No job (unassigned)</option>
                        {(jobs ?? []).map((j: { id: string; title: string }) => (
                          <option key={j.id} value={j.id}>{j.title}</option>
                        ))}
                      </select>
                    </form>
                  </td>
                  <td className="px-4 py-3">
                    {f.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="muted">Paused</Badge>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {f.last_synced_at ? formatDate(f.last_synced_at, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "Never"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1">
                      <SyncNowButton formId={f.form_id} />
                      <form action={toggleMetaFormActive} className="inline">
                        <input type="hidden" name="id" value={f.id} />
                        <input type="hidden" name="active" value={f.is_active ? "1" : "0"} />
                        <Button variant="ghost" size="sm" type="submit" className="text-xs" title={f.is_active ? "Pause" : "Resume"}>
                          <Power className="h-3.5 w-3.5" />
                        </Button>
                      </form>
                      <form action={deleteMetaForm} className="inline">
                        <input type="hidden" name="id" value={f.id} />
                        <Button variant="ghost" size="sm" type="submit" className="text-xs text-rose-500" title="Remove">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
