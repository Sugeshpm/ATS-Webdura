import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BackToSettings } from "@/components/settings/back-link";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const KINDS = [
  { value: "email",            label: "Email" },
  { value: "whatsapp",         label: "WhatsApp" },
  { value: "job_description",  label: "Job description" },
  { value: "offer_letter",     label: "Offer letter" },
  { value: "scorecard",        label: "Scorecard" },
  { value: "application_form", label: "Application form" }
] as const;

async function addTemplate(formData: FormData) {
  "use server";
  const kind = String(formData.get("kind") ?? "email");
  const name = String(formData.get("name") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "");
  if (!name) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("tenant_id").eq("id", user!.id).single();
  await supabase.from("templates").insert({
    tenant_id: me!.tenant_id,
    kind,
    name,
    subject: subject || null,
    body: body || null
  } as never);
  revalidatePath("/settings/templates");
}

async function deleteTemplate(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("templates").delete().eq("id", id);
  revalidatePath("/settings/templates");
}

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();

  let q = supabase.from("templates").select("id, kind, name, subject, body, created_at").order("created_at", { ascending: false });
  if (params.kind) q = q.eq("kind", params.kind);
  const { data: templates, error } = await q;

  const tableMissing = error?.message?.includes("does not exist") || error?.code === "42P01";

  return (
    <div className="container max-w-4xl py-8">
      <BackToSettings />
      <h1 className="text-xl font-semibold">Templates</h1>
      <p className="mt-1 text-sm text-muted-foreground">Email, WhatsApp, job descriptions, offer letters, and scorecards. Use <code>{"{{first_name}}"}</code> style variables — supported in Phase 2.</p>

      {tableMissing && (
        <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          <div className="font-medium">Templates table not found.</div>
          <p className="mt-1">Run the missing migration in the Supabase SQL editor: <code className="font-mono text-xs">supabase/migrations/20260623000009_templates.sql</code></p>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <a href="/settings/templates" className={`rounded-full border px-3 py-1 text-xs ${!params.kind ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>All</a>
        {KINDS.map((k) => (
          <a key={k.value} href={`/settings/templates?kind=${k.value}`}
            className={`rounded-full border px-3 py-1 text-xs ${params.kind === k.value ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
            {k.label}
          </a>
        ))}
      </div>

      <Card className="mt-6">
        <form action={addTemplate}>
          <CardHeader>
            <CardTitle className="text-base">New template</CardTitle>
            <CardDescription>Saved per organisation; reusable across jobs and candidates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name *</Label>
                <Input id="name" name="name" required placeholder="Screening invite" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kind">Kind</Label>
                <select id="kind" name="kind" defaultValue={params.kind ?? "email"} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                  {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" name="subject" placeholder="(Email/WhatsApp only)" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="body">Body</Label>
              <Textarea id="body" name="body" rows={6} placeholder={`Hi {{first_name}},\n\nThanks for applying to {{job_title}}. We'd love to chat...`} />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit">Create template</Button>
          </CardFooter>
        </form>
      </Card>

      <div className="mt-6 space-y-3">
        {(templates ?? []).map((t) => (
          <div key={t.id} className="rounded-md border border-border p-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{t.name}</span>
                  <Badge variant="outline">{KINDS.find((k) => k.value === t.kind)?.label ?? t.kind}</Badge>
                </div>
                {t.subject && <div className="mt-1 text-xs text-muted-foreground">Subject: {t.subject}</div>}
                {t.body && <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground line-clamp-3">{t.body}</p>}
                <div className="mt-2 text-[11px] text-muted-foreground">Created {formatDate(t.created_at)}</div>
              </div>
              <form action={deleteTemplate}>
                <input type="hidden" name="id" value={t.id} />
                <Button variant="ghost" size="sm" type="submit" className="text-xs text-rose-400 hover:text-rose-300">Delete</Button>
              </form>
            </div>
          </div>
        ))}
        {!tableMissing && (!templates || templates.length === 0) && (
          <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No templates yet. Create your first above.
          </div>
        )}
      </div>
    </div>
  );
}
