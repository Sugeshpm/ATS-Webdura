"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { metaOAuthListForms, registerFormViaOAuth, endMetaOAuthSession } from "../actions";
import { FieldMappingDialog } from "../forms/field-mapping-dialog";

interface Page { id: string; name: string; category: string | null }
interface Job { id: string; title: string }
interface Form { id: string; name: string; status: string | null }

export function ConnectWizard({
  pages,
  jobs,
  registeredFormIds
}: {
  pages: Page[];
  jobs: Job[];
  registeredFormIds: string[];
}) {
  const router = useRouter();
  const [selectedPage, setSelectedPage] = React.useState<Page | null>(null);
  const [forms, setForms] = React.useState<Form[] | null>(null);
  const [loadingForms, setLoadingForms] = React.useState(false);
  const [jobByForm, setJobByForm] = React.useState<Record<string, string>>({});
  const [registered, setRegistered] = React.useState<Set<string>>(new Set(registeredFormIds));
  const [pendingForm, setPendingForm] = React.useState<string | null>(null);

  async function loadForms(page: Page) {
    setSelectedPage(page);
    setForms(null);
    setLoadingForms(true);
    const res = await metaOAuthListForms(page.id);
    setLoadingForms(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setForms(res.forms);
    if (res.forms.length === 0) toast.info("This Page has no Lead Gen forms yet.");
  }

  async function register(form: Form) {
    if (!selectedPage) return;
    setPendingForm(form.id);
    const res = await registerFormViaOAuth({
      page_id: selectedPage.id,
      page_name: selectedPage.name,
      form_id: form.id,
      form_name: form.name,
      job_id: jobByForm[form.id] || null
    });
    setPendingForm(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setRegistered((prev) => new Set(prev).add(form.id));
    toast.success(`Synced "${form.name}". Use “Map fields” to control which questions fill the profile.`);
    router.refresh();
  }

  async function finish() {
    await endMetaOAuthSession();
    router.push("/settings/integrations/meta/forms");
  }

  if (pages.length === 0) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">No Pages found</CardTitle>
          <CardDescription>
            The Facebook account you signed in with doesn&apos;t manage any Pages, or you didn&apos;t grant the
            <code className="mx-1">pages_show_list</code> permission. Reconnect and approve all requested permissions.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {/* Step 1 — pick a Page */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base inline-flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-white">1</span>
            Choose a Page
          </CardTitle>
          <CardDescription>{pages.length} Page{pages.length === 1 ? "" : "s"} you manage.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {pages.map((p) => {
              const active = selectedPage?.id === p.id;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => loadForms(p)}
                    className={
                      "flex w-full items-center justify-between py-3 text-left transition-colors " +
                      (active ? "text-primary" : "hover:text-foreground/80")
                    }
                  >
                    <span>
                      <span className="block text-sm font-medium">{p.name}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {p.category ?? "Facebook Page"} · {p.id}
                      </span>
                    </span>
                    {active ? <Check className="h-4 w-4" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {/* Step 2 — pick a form */}
      {selectedPage && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base inline-flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-white">2</span>
                Choose a Lead Gen form
              </CardTitle>
              <CardDescription>Forms on “{selectedPage.name}”. Assign a job, sync the form, then map its fields.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => loadForms(selectedPage)} disabled={loadingForms} title="Refresh forms">
              <RefreshCw className={"h-3.5 w-3.5 " + (loadingForms ? "animate-spin" : "")} />
            </Button>
          </CardHeader>
          <CardContent>
            {loadingForms && (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading forms…
              </div>
            )}

            {!loadingForms && forms && forms.length === 0 && (
              <p className="py-6 text-sm text-muted-foreground">No Lead Gen forms on this Page yet.</p>
            )}

            {!loadingForms && forms && forms.length > 0 && (
              <ul className="divide-y divide-border">
                {forms.map((f) => {
                  const isRegistered = registered.has(f.id);
                  const busy = pendingForm === f.id;
                  return (
                    <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{f.name}</span>
                          {f.status && f.status.toUpperCase() !== "ACTIVE" && (
                            <Badge variant="muted">{f.status}</Badge>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-muted-foreground">{f.id}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={jobByForm[f.id] ?? ""}
                          onChange={(e) => setJobByForm((prev) => ({ ...prev, [f.id]: e.target.value }))}
                          disabled={isRegistered}
                          className="h-8 max-w-[190px] rounded-md border border-input bg-white px-2 text-xs disabled:opacity-60"
                        >
                          <option value="">— No job (candidate only)</option>
                          {jobs.map((j) => (
                            <option key={j.id} value={j.id}>{j.title}</option>
                          ))}
                        </select>
                        {isRegistered ? (
                          <>
                            <Badge variant="success"><Check className="mr-1 h-3 w-3" /> Synced</Badge>
                            <FieldMappingDialog formId={f.id} formName={f.name} />
                          </>
                        ) : (
                          <Button size="sm" onClick={() => register(f)} disabled={busy}>
                            {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                            {busy ? "Saving…" : "Sync this form"}
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          Your Facebook session is used only to fetch Pages and forms. It clears itself when you finish.
        </p>
        <Button variant="ghost" onClick={finish}>Done</Button>
      </div>
    </div>
  );
}
