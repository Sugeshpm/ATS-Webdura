import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: jobs } = await supabase
    .from("v_jobs_with_counts")
    .select("id, title, candidate_count, hires, openings")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  return (
    <div className="container py-8">
      <h1 className="text-xl font-semibold">Reports</h1>
      <p className="mt-1 text-sm text-muted-foreground">Pipeline funnel by job.</p>

      <ul className="mt-6 space-y-2">
        {(jobs ?? []).map((j: any) => (
          <li key={j.id} className="rounded-md border border-border p-3">
            <a href={`/jobs/${j.id}`} className="text-sm font-medium hover:underline">{j.title}</a>
            <div className="text-xs text-muted-foreground">{j.candidate_count} candidates · {j.hires}/{j.openings} hires</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
