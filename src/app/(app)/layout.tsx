import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, email, avatar_url, status, tenant:tenants ( name )")
    .eq("id", user.id)
    .single();

  const status = (profile as { status?: string } | null)?.status;
  if (!profile || (status !== "active" && status !== "invited")) {
    await supabase.auth.signOut();
    redirect(`/login?status=${status ?? "pending"}`);
  }

  const tenant = (profile as { tenant?: { name: string } | null } | null)?.tenant ?? null;

  return (
    <AppShell
      orgName={tenant?.name ?? "Organisation"}
      user={{
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email ?? user.email
      }}
    >
      {children}
    </AppShell>
  );
}
