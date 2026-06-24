import Link from "next/link";
import { CheckCircle2, XCircle, ShieldOff, ShieldCheck, MailPlus, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BackToSettings } from "@/components/settings/back-link";
import { initials, formatDate } from "@/lib/utils";
import { approveUser, rejectUser, setUserStatus, changeRole, resendInvite, inviteUser } from "./actions";

export const dynamic = "force-dynamic";

const ROLES = ["super_admin", "admin", "hiring_manager", "recruiter", "interviewer", "dept_head", "vendor"] as const;
const FILTERS = ["all", "pending", "active", "invited", "disabled", "rejected"] as const;
type Filter = typeof FILTERS[number];

interface ProfileRow {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  status: string;
  last_login_at: string | null;
  created_at: string;
}

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ filter?: Filter; invite?: "success" | "error"; msg?: string }> }) {
  const params = await searchParams;
  const filter = (FILTERS as readonly string[]).includes(params.filter ?? "") ? (params.filter as Filter) : "all";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("id, role").eq("id", user!.id).single();
  const isAdmin = ["super_admin", "admin"].includes(me?.role ?? "");

  const { data: allUsers } = await supabase
    .from("profiles")
    .select("id, email, first_name, last_name, role, status, last_login_at, created_at")
    .order("created_at", { ascending: false });

  const users: ProfileRow[] = (allUsers ?? []) as never;

  const counts = {
    all: users.length,
    pending: users.filter((u) => u.status === "pending").length,
    active: users.filter((u) => u.status === "active").length,
    invited: users.filter((u) => u.status === "invited").length,
    disabled: users.filter((u) => u.status === "disabled").length,
    rejected: users.filter((u) => u.status === "rejected").length
  };
  const visible = filter === "all" ? users : users.filter((u) => u.status === filter);

  return (
    <div className="container py-8">
      <BackToSettings />
      <h1 className="text-xl font-semibold">Users &amp; roles</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Review pending registrations, invite new members, and manage existing accounts.
      </p>

      {params.invite && params.msg && (
        <div className={`mt-4 rounded-md border p-3 text-sm ${
          params.invite === "success"
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
            : "border-rose-500/30 bg-rose-500/10 text-rose-200"
        }`}>
          {decodeURIComponent(params.msg)}
        </div>
      )}

      {/* Status filter chips */}
      <div className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "all" ? "/settings/users" : `/settings/users?filter=${f}`}
            className={`rounded-full border px-3 py-1 text-xs ${filter === f ? "border-primary text-primary" : "border-border text-muted-foreground hover:border-foreground/30"}`}
          >
            {labelFor(f)} <span className="ml-1 opacity-60">{counts[f]}</span>
          </Link>
        ))}
      </div>

      {isAdmin && (
        <Card className="mt-6">
          <form action={inviteUser}>
            <CardHeader>
              <CardTitle className="text-base inline-flex items-center gap-2"><MailPlus className="h-4 w-4" /> Invite member</CardTitle>
              <CardDescription>Invited users skip approval — they activate on their first sign-in.</CardDescription>
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
                <select name="role" defaultValue="recruiter" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                  {ROLES.map((r) => <option key={r} value={r}>{labelForRole(r)}</option>)}
                </select>
              </div>
            </CardContent>
            <CardFooter><Button type="submit">Send invite</Button></CardFooter>
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
              <th className="px-3 py-2 text-left">Last sign-in</th>
              {isAdmin && <th className="px-3 py-2 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {visible.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7"><AvatarFallback className="text-[10px]">{initials(u.first_name, u.last_name)}</AvatarFallback></Avatar>
                    <span>{u.first_name} {u.last_name}{u.id === me?.id && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{u.email}</td>
                <td className="px-3 py-2">
                  {isAdmin && u.id !== me?.id ? (
                    <form action={async (fd) => { "use server"; await changeRole(u.id, String(fd.get("role"))); }} className="inline-flex">
                      <select name="role" defaultValue={u.role} onChange={(e) => (e.currentTarget.form as HTMLFormElement).requestSubmit()}
                        className="h-7 rounded-md border border-input bg-transparent px-2 text-xs">
                        {ROLES.map((r) => <option key={r} value={r}>{labelForRole(r)}</option>)}
                      </select>
                    </form>
                  ) : <Badge variant="outline">{labelForRole(u.role)}</Badge>}
                </td>
                <td className="px-3 py-2"><StatusBadge status={u.status} /></td>
                <td className="px-3 py-2 text-muted-foreground">{formatDate(u.created_at)}</td>
                <td className="px-3 py-2 text-muted-foreground">{u.last_login_at ? formatDate(u.last_login_at) : "—"}</td>
                {isAdmin && (
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap justify-end gap-1">
                      <RowActions targetId={u.id} email={u.email} status={u.status} isSelf={u.id === me?.id} />
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={isAdmin ? 7 : 6} className="px-3 py-8 text-center text-sm text-muted-foreground">
                No users in this view.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function labelFor(f: Filter): string {
  return ({ all: "All", pending: "Pending", active: "Active", invited: "Invited", disabled: "Disabled", rejected: "Rejected" } as const)[f];
}

function labelForRole(r: string) {
  return r.replace(/_/g, " ");
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active")   return <Badge variant="online">Active</Badge>;
  if (status === "invited")  return <Badge variant="confidential">Invited</Badge>;
  if (status === "pending")  return <Badge variant="confidential">Pending</Badge>;
  if (status === "rejected") return <Badge variant="offline" className="text-rose-300">Rejected</Badge>;
  if (status === "disabled") return <Badge variant="offline">Disabled</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function RowActions({ targetId, email, status, isSelf }: { targetId: string; email: string; status: string; isSelf: boolean }) {
  if (isSelf) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  if (status === "pending") {
    return (
      <>
        <ActionForm fn={approveUser} targetId={targetId} variant="default"><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Approve</ActionForm>
        <ActionForm fn={rejectUser} targetId={targetId} variant="ghost"><XCircle className="mr-1 h-3.5 w-3.5" /> Reject</ActionForm>
      </>
    );
  }
  if (status === "invited") {
    return (
      <>
        <ResendForm email={email} />
        <SetStatusForm targetId={targetId} status="rejected" variant="ghost"><XCircle className="mr-1 h-3.5 w-3.5" /> Cancel</SetStatusForm>
      </>
    );
  }
  if (status === "active") {
    return <SetStatusForm targetId={targetId} status="disabled" variant="ghost"><ShieldOff className="mr-1 h-3.5 w-3.5" /> Disable</SetStatusForm>;
  }
  if (status === "disabled") {
    return <SetStatusForm targetId={targetId} status="active" variant="default"><ShieldCheck className="mr-1 h-3.5 w-3.5" /> Reactivate</SetStatusForm>;
  }
  if (status === "rejected") {
    return <SetStatusForm targetId={targetId} status="active" variant="default"><Clock className="mr-1 h-3.5 w-3.5" /> Approve</SetStatusForm>;
  }
  return null;
}

function ActionForm({ fn, targetId, variant, children }: { fn: (id: string) => Promise<unknown>; targetId: string; variant: React.ComponentProps<typeof Button>["variant"]; children: React.ReactNode }) {
  return (
    <form action={async () => { "use server"; await fn(targetId); }} className="inline">
      <Button size="sm" variant={variant} type="submit" className="text-xs">{children}</Button>
    </form>
  );
}

function SetStatusForm({ targetId, status, variant, children }: { targetId: string; status: "active" | "disabled" | "rejected" | "pending"; variant: React.ComponentProps<typeof Button>["variant"]; children: React.ReactNode }) {
  return (
    <form action={async () => { "use server"; await setUserStatus(targetId, status); }} className="inline">
      <Button size="sm" variant={variant} type="submit" className="text-xs">{children}</Button>
    </form>
  );
}

function ResendForm({ email }: { email: string }) {
  return (
    <form action={async () => { "use server"; await resendInvite(email); }} className="inline">
      <Button size="sm" variant="ghost" type="submit" className="text-xs"><MailPlus className="mr-1 h-3.5 w-3.5" /> Resend</Button>
    </form>
  );
}
