import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { BackToSettings } from "@/components/settings/back-link";

export const dynamic = "force-dynamic";

async function updateOrg(formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "").trim();
  const primary_color = String(formData.get("primary_color") ?? "").trim();
  const time_zone = String(formData.get("time_zone") ?? "").trim();
  const logo_url = String(formData.get("logo_url") ?? "").trim();

  if (!name) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user!.id).single();

  await supabase
    .from("tenants")
    .update({ name, primary_color: primary_color || null, time_zone: time_zone || null, logo_url: logo_url || null })
    .eq("id", profile!.tenant_id);

  revalidatePath("/settings/organisation");
  revalidatePath("/", "layout");
}

export default async function OrganisationSettingsPage() {
  const supabase = await createClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, slug, logo_url, primary_color, time_zone")
    .single();

  return (
    <div className="container max-w-2xl py-8">
      <BackToSettings />
      <h1 className="text-xl font-semibold">Organisation</h1>
      <p className="mt-1 text-sm text-muted-foreground">Basic identity for your tenant. Shown in the top header.</p>

      <Card className="mt-6">
        <form action={updateOrg}>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
            <CardDescription>Name appears in the top header for everyone in this org.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Organisation name *</Label>
              <Input id="name" name="name" required defaultValue={tenant?.name ?? ""} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="slug">URL slug</Label>
                <Input id="slug" name="slug" defaultValue={tenant?.slug ?? ""} disabled />
                <p className="text-[11px] text-muted-foreground">Set automatically at signup; contact support to change.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="time_zone">Time zone</Label>
                <Input id="time_zone" name="time_zone" defaultValue={tenant?.time_zone ?? "Asia/Kolkata"} placeholder="Asia/Kolkata" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="primary_color">Primary colour</Label>
                <Input id="primary_color" name="primary_color" defaultValue={tenant?.primary_color ?? "#8b5cf6"} placeholder="#8b5cf6" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="logo_url">Logo URL</Label>
                <Input id="logo_url" name="logo_url" defaultValue={tenant?.logo_url ?? ""} placeholder="https://…/logo.svg" />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit">Save changes</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
