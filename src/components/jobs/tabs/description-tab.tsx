import Link from "next/link";
import { Pencil, MapPin, Briefcase, IndianRupee, Eye, Building2, Calendar, Users, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

interface Props {
  jobId: string;
  job: {
    title: string;
    description: string | null;
    department_name: string | null;
    location_name: string | null;
    business_unit_name: string | null;
    employment_type: string | null;
    experience_min: number | null;
    experience_max: number | null;
    salary_min: number | null;
    salary_max: number | null;
    salary_currency: string | null;
    openings: number;
    hires: number;
    visibility: string;
    confidential: boolean;
    priority: boolean;
    target_close_date: string | null;
    created_at: string;
    skills: string[];
  };
}

export function JobDescriptionTab({ jobId, job }: Props) {
  const salaryRange = formatSalary(job.salary_min, job.salary_max, job.salary_currency);
  const experience = formatExperience(job.experience_min, job.experience_max);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Description */}
      <section className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">About the role</h2>
          <Button asChild variant="outline" size="sm">
            <Link href={`/jobs/${jobId}/edit`}><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</Link>
          </Button>
        </header>

        {job.description ? (
          <article className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {job.description}
          </article>
        ) : (
          <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            No description yet. <Link href={`/jobs/${jobId}/edit`} className="text-primary hover:underline">Add one</Link>.
          </div>
        )}

        {/* Skills */}
        <div className="mt-6">
          <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">Skills</div>
          {job.skills.length === 0 ? (
            <p className="text-xs text-muted-foreground">No skills specified.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {job.skills.map((s) => <Badge key={s} variant="outline">{s}</Badge>)}
            </div>
          )}
        </div>
      </section>

      {/* Metadata */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold">Details</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
          <Field icon={MapPin}    label="Location"     value={job.location_name ?? "—"} />
          <Field icon={Briefcase} label="Job type"     value={formatEmploymentType(job.employment_type)} />
          <Field icon={Building2} label="Department"   value={job.department_name ?? "—"} />
          <Field icon={Building2} label="Business unit" value={job.business_unit_name ?? "—"} />
          <Field icon={Star}      label="Experience"   value={experience} />
          <Field icon={IndianRupee} label="Salary"     value={salaryRange} />
          <Field icon={Users}     label="Positions"    value={`${job.hires} hired / ${job.openings} total`} />
          <Field icon={Eye}       label="Visibility"   value={formatVisibility(job)} />
          <Field icon={Calendar}  label="Target close" value={job.target_close_date ? formatDate(job.target_close_date) : "—"} />
          <Field icon={Calendar}  label="Created"      value={formatDate(job.created_at)} />
        </dl>

        {/* Flags */}
        {(job.priority || job.confidential) && (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
            {job.confidential && <Badge variant="confidential">Confidential</Badge>}
            {job.priority && <Badge variant="priority">Priority</Badge>}
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />{label}
      </dt>
      <dd className="mt-1 text-sm">{value}</dd>
    </div>
  );
}

function formatEmploymentType(t: string | null) {
  if (!t) return "—";
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatExperience(min: number | null, max: number | null) {
  if (min == null && max == null) return "—";
  if (min != null && max != null) return `${min} – ${max} years`;
  if (min != null) return `${min}+ years`;
  return `Up to ${max} years`;
}

function formatSalary(min: number | null, max: number | null, currency: string | null) {
  const c = currency ?? "INR";
  if (min == null && max == null) return "Not disclosed";
  const fmt = (n: number) => n.toLocaleString();
  if (min != null && max != null) return `${c} ${fmt(min)} – ${fmt(max)}`;
  if (min != null) return `${c} ${fmt(min)}+`;
  return `Up to ${c} ${fmt(max!)}`;
}

function formatVisibility(job: { visibility: string; confidential: boolean }) {
  if (job.confidential) return "Confidential";
  if (job.visibility === "career_site") return "Career site";
  if (job.visibility === "external") return "External boards";
  return "Internal";
}
