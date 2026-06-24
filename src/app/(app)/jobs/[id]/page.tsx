import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteJobButton } from "@/components/jobs/delete-job-button";
import { formatDate } from "@/lib/utils";
import { Calendar, MapPin, Briefcase, Users, Pencil } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: job } = await supabase.from("v_jobs_with_counts").select("*").eq("id", id).single();
  if (!job) return notFound();

  const { data: funnel } = await supabase.rpc("job_funnel", { p_job_id: id }) as {
    data: { stage_id: string; stage_name: string; stage_order: number; count: number }[] | null;
  };

  return (
    <div className="container py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{job.department_name ?? "—"}</p>
          <h1 className="text-2xl font-semibold">{job.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" />{job.employment_type ?? "Full-time"}</span>
            <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.location_name ?? "Remote"}</span>
            <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{job.hires}/{job.openings} hires</span>
            {job.target_close_date && (
              <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Closes {formatDate(job.target_close_date)}</span>
            )}
            {job.confidential && <Badge variant="confidential">CONFIDENTIAL</Badge>}
            {job.priority && <Badge variant="priority">PRIORITY</Badge>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild variant="outline">
            <Link href={`/jobs/${id}/edit`}><Pencil className="mr-1 h-4 w-4" /> Edit</Link>
          </Button>
          <DeleteJobButton jobId={id} jobTitle={job.title} />
        </div>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {(funnel ?? []).map((row) => (
          <div key={row.stage_id} className="rounded-md border border-border bg-card p-3">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{row.stage_name}</div>
            <div className="mt-1 text-2xl font-semibold">{row.count}</div>
          </div>
        ))}
      </section>

      <section className="mt-8">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Description</h2>
        <article className="prose prose-invert max-w-none whitespace-pre-wrap text-sm">{job.description ?? "No description provided."}</article>
      </section>
    </div>
  );
}
