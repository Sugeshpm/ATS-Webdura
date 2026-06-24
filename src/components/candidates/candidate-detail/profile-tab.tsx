import { User, Briefcase, GraduationCap, Sparkles, Award, Link2, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Education { id: string; institution: string | null; degree: string | null; field: string | null; start_year: number | null; end_year: number | null; grade: string | null }
interface Experience { id: string; company: string | null; title: string | null; start_date: string | null; end_date: string | null; is_current: boolean; description: string | null }
interface Candidate {
  first_name: string; middle_name: string | null; last_name: string | null;
  email: string | null; phone: string | null; gender: string | null; date_of_birth: string | null;
  current_company: string | null; current_location: string | null; preferred_location: string | null;
  experience_years: number | null; experience_months: number | null; notice_period_days: number | null;
  current_salary: number | null; current_salary_currency: string | null;
  expected_salary: number | null; expected_salary_currency: string | null;
  linkedin_url: string | null; github_url: string | null; portfolio_url: string | null;
  source: string | null;
}

interface Props {
  candidate: Candidate;
  experiences: Experience[];
  educations: Education[];
  skills: { id: string; name: string }[];
}

export function ProfileTab({ candidate, experiences, educations, skills }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Section icon={User} title="Personal information">
        <DefList>
          <Row label="Full name" value={`${candidate.first_name} ${candidate.middle_name ?? ""} ${candidate.last_name ?? ""}`.replace(/\s+/g, " ").trim()} />
          <Row label="Email" value={candidate.email ?? "—"} />
          <Row label="Phone" value={candidate.phone ?? "—"} />
          <Row label="Gender" value={candidate.gender ? candidate.gender[0].toUpperCase() + candidate.gender.slice(1) : "—"} />
          <Row label="Date of birth" value={candidate.date_of_birth ?? "—"} />
          <Row label="Current location" value={candidate.current_location ?? "—"} />
          <Row label="Preferred location" value={candidate.preferred_location ?? "—"} />
        </DefList>
      </Section>

      <Section icon={Briefcase} title="Professional information">
        <DefList>
          <Row label="Current company" value={candidate.current_company ?? "—"} />
          <Row label="Total experience" value={`${candidate.experience_years ?? 0}y ${candidate.experience_months ?? 0}m`} />
          <Row label="Notice period" value={candidate.notice_period_days != null ? `${candidate.notice_period_days} days` : "—"} />
          <Row label="Current salary" value={candidate.current_salary ? `${candidate.current_salary_currency ?? ""} ${candidate.current_salary.toLocaleString()}` : "—"} />
          <Row label="Expected salary" value={candidate.expected_salary ? `${candidate.expected_salary_currency ?? ""} ${candidate.expected_salary.toLocaleString()}` : "—"} />
          <Row label="Source" value={candidate.source ?? "—"} />
        </DefList>
      </Section>

      <Section icon={Sparkles} title="Skills" className="lg:col-span-2">
        {skills.length === 0 ? (
          <Empty hint="Skills added on the candidate will appear here." />
        ) : (
          <div className="flex flex-wrap gap-2">
            {skills.map((s) => <Badge key={s.id} variant="outline">{s.name}</Badge>)}
          </div>
        )}
      </Section>

      <Section icon={Briefcase} title="Work experience" className="lg:col-span-2">
        {experiences.length === 0 ? (
          <Empty hint="No experience records yet. Add experience to build a fuller candidate profile." />
        ) : (
          <ol className="space-y-3">
            {experiences.map((e) => (
              <li key={e.id} className="relative pl-5">
                <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                <div className="text-sm font-medium">{e.title ?? "Untitled role"} <span className="text-muted-foreground">· {e.company ?? "Unknown company"}</span></div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {e.start_date ?? "—"} — {e.is_current ? "Present" : (e.end_date ?? "—")}
                </div>
                {e.description && <p className="mt-1 text-sm text-muted-foreground">{e.description}</p>}
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section icon={GraduationCap} title="Education">
        {educations.length === 0 ? (
          <Empty hint="No education records yet." />
        ) : (
          <ul className="space-y-3">
            {educations.map((e) => (
              <li key={e.id}>
                <div className="text-sm font-medium">{e.degree ?? "Degree"} {e.field && <span className="font-normal text-muted-foreground">· {e.field}</span>}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {e.institution ?? "Unknown institution"} · {e.start_year ?? "—"} – {e.end_year ?? "—"}{e.grade ? ` · ${e.grade}` : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={Award} title="Certifications">
        <Empty hint="No certifications recorded." />
      </Section>

      <Section icon={Link2} title="Social links" className="lg:col-span-2">
        <div className="flex flex-wrap gap-2 text-sm">
          <SocialLink label="LinkedIn" url={candidate.linkedin_url} />
          <SocialLink label="GitHub" url={candidate.github_url} />
          <SocialLink label="Portfolio" url={candidate.portfolio_url} />
          {!candidate.linkedin_url && !candidate.github_url && !candidate.portfolio_url && (
            <Empty hint="No social profiles linked." />
          )}
        </div>
      </Section>
    </div>
  );
}

function Section({ icon: Icon, title, children, className }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-border bg-card p-5 ${className ?? ""}`}>
      <header className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-3.5 w-3.5" />
        </span>
        {title}
      </header>
      {children}
    </section>
  );
}

function DefList({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">{children}</dl>;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

function Empty({ hint }: { hint: string }) {
  return (
    <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
      {hint}
    </div>
  );
}

function SocialLink({ label, url }: { label: string; url: string | null }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/40 px-3 py-1.5 text-xs hover:border-primary/40 hover:text-foreground"
    >
      <BookOpen className="h-3.5 w-3.5 opacity-60" />
      {label}
    </a>
  );
}
