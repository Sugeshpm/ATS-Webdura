import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readMetaOAuthSession } from "@/lib/meta/oauth";
import { listPages, MetaGraphError, type MetaPageWithToken } from "@/lib/meta/graph";
import { BackToSettings } from "@/components/settings/back-link";
import { ConnectWizard } from "./connect-wizard";

export const dynamic = "force-dynamic";

function bail(msg: string): never {
  redirect(`/settings/integrations/meta?msg=error:${encodeURIComponent(msg)}`);
}

export default async function MetaConnectPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!me || !["super_admin", "admin"].includes((me as { role: string }).role)) {
    bail("Admin only.");
  }

  const session = await readMetaOAuthSession();
  if (!session) bail("Facebook session expired — please reconnect.");

  const [{ data: jobs }, { data: existing }] = await Promise.all([
    supabase.from("jobs").select("id, title").eq("status", "active").order("title"),
    supabase.from("meta_lead_forms").select("form_id")
  ]);

  let pages: MetaPageWithToken[];
  try {
    pages = await listPages(session.token);
  } catch (e) {
    bail(e instanceof MetaGraphError ? e.message : (e as Error).message);
  }

  // Strip Page access tokens before handing data to the client component.
  const safePages = pages.map((p) => ({ id: p.id, name: p.name, category: p.category ?? null }));
  const registeredFormIds = ((existing ?? []) as { form_id: string }[]).map((e) => e.form_id);

  return (
    <div className="container max-w-3xl py-8">
      <BackToSettings />
      <h1 className="text-xl font-semibold">Connect a Facebook Page</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        You&apos;re signed in with Facebook. Pick a Page, then choose the Lead Gen form to sync into your pipeline.
      </p>

      <ConnectWizard
        pages={safePages}
        jobs={(jobs ?? []) as { id: string; title: string }[]}
        registeredFormIds={registeredFormIds}
      />
    </div>
  );
}
