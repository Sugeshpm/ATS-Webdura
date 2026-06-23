import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BackToSettings } from "@/components/settings/back-link";

export const dynamic = "force-dynamic";

async function addStage(formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? "#a78bfa").trim();
  const orderRaw = formData.get("order");
  const order = orderRaw ? Number(orderRaw) : 999;
  if (!name) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("tenant_id").eq("id", user!.id).single();

  const code = "custom_" + name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  await supabase.from("stages").insert({ tenant_id: me!.tenant_id, code, name, color, order });
  revalidatePath("/settings/stages");
}

async function updateStage(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const orderRaw = formData.get("order");
  const order = orderRaw ? Number(orderRaw) : undefined;
  if (!id || !name) return;
  const supabase = await createClient();
  await supabase.from("stages").update({ name, ...(order !== undefined ? { order } : {}) }).eq("id", id);
  revalidatePath("/settings/stages");
}

async function toggleArchive(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const is_archived = formData.get("is_archived") === "true";
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("stages").update({ is_archived: !is_archived }).eq("id", id);
  revalidatePath("/settings/stages");
}

export default async function StagesPage() {
  const supabase = await createClient();
  const { data: stages } = await supabase
    .from("stages")
    .select("id, code, name, order, color, is_terminal, is_archived")
    .order("order");

  return (
    <div className="container max-w-4xl py-8">
      <BackToSettings />
      <h1 className="text-xl font-semibold">Pipeline stages</h1>
      <p className="mt-1 text-sm text-muted-foreground">Customise the stages candidates move through. Terminal stages (Hired, Rejected) close out a pipeline.</p>

      <Card className="mt-6">
        <form action={addStage}>
          <CardHeader>
            <CardTitle className="text-base">Add custom stage</CardTitle>
            <CardDescription>Sits in your pipeline alongside the 11 default stages.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" required placeholder="Assignment" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="order">Order</Label>
              <Input id="order" name="order" type="number" defaultValue={55} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="color">Colour (hex)</Label>
              <Input id="color" name="color" defaultValue="#a78bfa" />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit">Add stage</Button>
          </CardFooter>
        </form>
      </Card>

      <div className="mt-6 overflow-x-auto rounded-md border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-secondary/40 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left w-16">Order</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Code</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {(stages ?? []).map((s: any) => (
              <tr key={s.id} className="border-t border-border">
                <td className="px-3 py-2 text-muted-foreground">
                  <form action={updateStage} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="name" value={s.name} />
                    <input name="order" type="number" defaultValue={s.order} className="h-7 w-16 rounded-md border border-input bg-transparent px-2 text-xs" />
                    <Button variant="ghost" size="sm" type="submit" className="text-[10px]">save</Button>
                  </form>
                </td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color ?? "#a78bfa" }} />
                    <form action={updateStage} className="inline-flex items-center gap-1">
                      <input type="hidden" name="id" value={s.id} />
                      <input name="name" defaultValue={s.name} className="h-7 w-44 rounded-md border border-input bg-transparent px-2 text-sm" />
                      <Button variant="ghost" size="sm" type="submit" className="text-[10px]">save</Button>
                    </form>
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{s.code}</td>
                <td className="px-3 py-2">{s.is_terminal ? <Badge variant="offline">Terminal</Badge> : <Badge variant="outline">Step</Badge>}</td>
                <td className="px-3 py-2">{s.is_archived ? <Badge variant="offline">Archived</Badge> : <Badge variant="online">Active</Badge>}</td>
                <td className="px-3 py-2 text-right">
                  {!s.is_terminal && (
                    <form action={toggleArchive} className="inline">
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="is_archived" value={String(s.is_archived)} />
                      <Button variant="ghost" size="sm" type="submit" className="text-xs">{s.is_archived ? "Restore" : "Archive"}</Button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {(!stages || stages.length === 0) && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">No stages yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
