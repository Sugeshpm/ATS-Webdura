import { GitBranch, Briefcase, CalendarDays, StickyNote, Clock } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Props {
  stage: { name: string; color: string | null } | null;
  appliedJobsCount: number;
  interviewsCount: number;
  notesCount: number;
  lastActivityAt: string | null;
}

export function SummaryCards({ stage, appliedJobsCount, interviewsCount, notesCount, lastActivityAt }: Props) {
  const items = [
    {
      label: "Hiring stage",
      value: stage?.name ?? "—",
      icon: GitBranch,
      tone: stage?.color ?? "hsl(var(--primary))"
    },
    {
      label: "Applied jobs",
      value: appliedJobsCount,
      icon: Briefcase,
      tone: "hsl(var(--primary))"
    },
    {
      label: "Interviews",
      value: interviewsCount,
      icon: CalendarDays,
      tone: "hsl(200 80% 60%)"
    },
    {
      label: "Notes",
      value: notesCount,
      icon: StickyNote,
      tone: "hsl(45 90% 60%)"
    },
    {
      label: "Last activity",
      value: lastActivityAt ? formatDate(lastActivityAt) : "—",
      icon: Clock,
      tone: "hsl(160 70% 50%)"
    }
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map(({ label, value, icon: Icon, tone }) => (
        <div key={label} className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
            <span
              className="flex h-8 w-8 items-center justify-center rounded-md"
              style={{ background: `color-mix(in srgb, ${tone} 18%, transparent)`, color: tone }}
            >
              <Icon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 truncate text-xl font-semibold">{value}</div>
        </div>
      ))}
    </div>
  );
}
