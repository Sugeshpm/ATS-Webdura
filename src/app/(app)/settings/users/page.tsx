import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BackToSettings } from "@/components/settings/back-link";
import { initials, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ROLES = [
  "super_admin", "admin", "hiring_manager", "recruiter", "interviewer", "dept_head", "vendor"
] as const;

async function inviteUser(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim();
  const first_name = String(formData.get("first_name") ?? "").trim();
  const last_name = String(formData.get("last_name") ?? "").trim();
  const role = String(formData.get("role") ?? "recruiter");
  if (!email) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("tenant_id, role").eq("id", user!.id).single();
  if (!me || !["super_admin", "admin"].includes(me.role)) return;

  const admin = createServiceClient();
  const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { first_name, last_name, tenant_id: me.tenant_id, invited_by_admin: true },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`
  });

  if (error || !invited?.user) return;

  // The handle_new_user trigger creates a fresh tenant for any new auth.users row.
  // For an invited member we instead want them in THE INVITER'S tenant, so we overwrite.
  await admin.from("profiles").update({ tenant_id: me.tenant_id, role, status: "invited", first_name, last_name }).eq("id", invited.user.id);

  revalidatePath("/settings/users");
}

async function changeRole(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!id || !role) return;
  const supabase = await createClient();
  await supabase.from("profiles").update({ role }).eq("id", id);
  revalidatePath("/settings/users");
}

async function setStatus(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !status) return;
  const supabase = await createClient();
  await supabase.from("profiles").update({ status }).eq("id", id);
  revalidatePath("/settings/users");
}

export default async function UsersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("id, role").eq("id", user!.id).single();
  const isAdmin = ["super_admin", "admin"].includes(me?.role ?? "");

  const { data: users } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email, role, status, last_login_at, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="container py-8">
      <BackToSettings />
      <h1 className="text-xl font-semibold">Users & roles</h1>
      <p className="mt-1 text-sm text-muted-foreground">{users?.length ?? 0} member{users?.length === 1 ? "" : "s"} in this organisation.</p>

      {isAdmin && (
        <Card className="mt-6">
          <form action={inviteUser}>
            <CardHeader>
              <CardTitle className="text-base">Invite member</CardTitle>
              <CardDescription>They&apos;ll get an email with a sign-in link to join this org.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="first_name">First name</Label>
                <Input id="first_name" name="first_name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="last_name">Last name</Label>
                <Input id="last_name" name="last_name" />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select name="role" defaultValue="recruiter">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r} value={r}>{r.replace("_", " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
                {/* server actions don't read shadcn Select; mirror as hidden native select */}
                <noscript className="hidden" />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit">Send invite</Button>
            </CardFooter>
          </form>
        </Card>
      )}

      <div className="mt-6 overflow-x-auto rounded-md border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-secondary/40 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Member</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Role</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Joined</th>
              {isAdmin && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7"><AvatarFallback className="text-[10px]">{initials(u.first_name, u.last_name)}</AvatarFallback></Avatar>
                    <span>{u.first_name} {u.last_name}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{u.email}</td>
                <td className="px-3 py-2">
                  {isAdmin && u.id !== me?.id ? (
                    <form action={changeRole} className="inline-flex">
                      <input type="hidden" name="id" value={u.id} />
                      <select name="role" defaultValue={u.role} onChange={(e) => (e.currentTarget.form as HTMLFormElement).requestSubmit()}
                        className="h-7 rounded-md border border-input bg-transparent px-2 text-xs">
                        {ROLES.map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
                      </select>
                    </form>
                  ) : <Badge variant="outline">{u.role.replace("_", " ")}</Badge>}
                </td>
                <td className="px-3 py-2">
                  {u.status === "active"   && <Badge variant="online">Active</Badge>}
                  {u.status === "invited"  && <Badge variant="confidential">Invited</Badge>}
                  {u.status === "disabled" && <Badge variant="offline">Disabled</Badge>}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{formatDate(u.created_at)}</td>
                {isAdmin && (
                  <td className="px-3 py-2 text-right">
                    {u.id !== me?.id && (
                      <form action={setStatus} className="inline">
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="status" value={u.status === "disabled" ? "active" : "disabled"} />
                        <Button variant="ghost" size="sm" type="submit" className="text-xs">
                          {u.status === "disabled" ? "Reactivate" : "Disable"}
                        </Button>
                      </form>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {(!users || users.length === 0) && (
              <tr><td colSpan={isAdmin ? 6 : 5} className="px-3 py-6 text-center text-sm text-muted-foreground">No users yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
