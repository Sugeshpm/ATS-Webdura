import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BackToSettings } from "@/components/settings/back-link";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function addDepartment(formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("tenant_id").eq("id", user!.id).single();
  await supabase.from("departments").insert({ tenant_id: me!.tenant_id, name });
  revalidatePath("/settings/departments");
}

async function toggleArchive(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const is_archived = formData.get("is_archived") === "true";
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("departments").update({ is_archived: !is_archived }).eq("id", id);
  revalidatePath("/settings/departments");
}

export default async function DepartmentsPage() {
  const supabase = await createClient();
  const { data: departments } = await supabase
    .from("departments")
    .select("id, name, is_archived, created_at")
    .order("name");

  return (
    <div className="container max-w-3xl py-8">
      <BackToSettings />
      <h1 className="text-xl font-semibold">Departments</h1>
      <p className="mt-1 text-sm text-muted-foreground">Used on jobs and reports to slice the pipeline by team.</p>

      <Card className="mt-6">
        <form action={addDepartment}>
          <CardHeader>
            <CardTitle className="text-base">Add department</CardTitle>
            <CardDescription>E.g. Tech, Sales, Creative, SEO, Coverage.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" required placeholder="Tech" />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit">Add</Button>
          </CardFooter>
        </form>
      </Card>

      <div className="mt-6 overflow-x-auto rounded-md border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-secondary/40 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Created</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {(departments ?? []).map((d) => (
              <tr key={d.id} className="border-t border-border">
                <td className="px-3 py-2">{d.name}</td>
                <td className="px-3 py-2">
                  {d.is_archived ? <Badge variant="offline">Archived</Badge> : <Badge variant="online">Active</Badge>}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{formatDate(d.created_at)}</td>
                <td className="px-3 py-2 text-right">
                  <form action={toggleArchive} className="inline">
                    <input type="hidden" name="id" value={d.id} />
                    <input type="hidden" name="is_archived" value={String(d.is_archived)} />
                    <Button variant="ghost" size="sm" type="submit" className="text-xs">
                      {d.is_archived ? "Restore" : "Archive"}
                    </Button>
                  </form>
                </td>
              </tr>
            ))}
            {(!departments || departments.length === 0) && (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-sm text-muted-foreground">No departments yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
