import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OrgHeader } from "@/components/layout/org-header";
import { TopNav } from "@/components/layout/top-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, email, avatar_url, tenant_id")
    .eq("id", user.id)
    .single();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", profile?.tenant_id ?? "")
    .single();

  return (
    <div className="flex min-h-screen flex-col">
      <OrgHeader
        orgName={tenant?.name ?? "Organisation"}
        user={{
          first_name: profile?.first_name,
          last_name: profile?.last_name,
          email: profile?.email ?? user.email,
          avatar_url: profile?.avatar_url
        }}
      />
      <TopNav />
      <main className="flex-1">{children}</main>
    </div>
  );
}
