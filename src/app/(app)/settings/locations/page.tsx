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

async function addLocation(formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();
  if (!name) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("tenant_id").eq("id", user!.id).single();
  await supabase.from("locations").insert({ tenant_id: me!.tenant_id, name, city: city || null, country: country || null });
  revalidatePath("/settings/locations");
}

async function toggleArchive(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const is_archived = formData.get("is_archived") === "true";
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("locations").update({ is_archived: !is_archived }).eq("id", id);
  revalidatePath("/settings/locations");
}

export default async function LocationsPage() {
  const supabase = await createClient();
  const { data: locations } = await supabase
    .from("locations")
    .select("id, name, city, country, is_archived, created_at")
    .order("name");

  return (
    <div className="container max-w-3xl py-8">
      <BackToSettings />
      <h1 className="text-xl font-semibold">Locations</h1>
      <p className="mt-1 text-sm text-muted-foreground">Office locations or remote zones used on jobs.</p>

      <Card className="mt-6">
        <form action={addLocation}>
          <CardHeader>
            <CardTitle className="text-base">Add location</CardTitle>
            <CardDescription>E.g. Kalamassery Office, Kozhikode, Remote India.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" required placeholder="Kalamassery Office" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" placeholder="Kochi" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="country">Country</Label>
              <Input id="country" name="country" placeholder="India" />
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
              <th className="px-3 py-2 text-left">City</th>
              <th className="px-3 py-2 text-left">Country</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Created</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {(locations ?? []).map((l) => (
              <tr key={l.id} className="border-t border-border">
                <td className="px-3 py-2">{l.name}</td>
                <td className="px-3 py-2 text-muted-foreground">{l.city ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{l.country ?? "—"}</td>
                <td className="px-3 py-2">{l.is_archived ? <Badge variant="offline">Archived</Badge> : <Badge variant="online">Active</Badge>}</td>
                <td className="px-3 py-2 text-muted-foreground">{formatDate(l.created_at)}</td>
                <td className="px-3 py-2 text-right">
                  <form action={toggleArchive} className="inline">
                    <input type="hidden" name="id" value={l.id} />
                    <input type="hidden" name="is_archived" value={String(l.is_archived)} />
                    <Button variant="ghost" size="sm" type="submit" className="text-xs">{l.is_archived ? "Restore" : "Archive"}</Button>
                  </form>
                </td>
              </tr>
            ))}
            {(!locations || locations.length === 0) && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">No locations yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
