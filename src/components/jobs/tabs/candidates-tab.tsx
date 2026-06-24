import Link from "next/link";
import { CandidateTable, type CandidateRow } from "@/components/candidates/candidate-table";

interface FunnelRow { stage_id: string; stage_name: string; count: number }

interface Props {
  jobId: string;
  rows: CandidateRow[];
  funnel: FunnelRow[];
  activeStageId: string | null;
}

export function JobCandidatesTab({ jobId, rows, funnel, activeStageId }: Props) {
  const total = funnel.reduce((sum, s) => sum + Number(s.count), 0);

  return (
    <div className="space-y-4">
      {/* Stage filter pills */}
      <div className="overflow-x-auto">
        <ul className="flex min-w-max items-stretch gap-2">
          <li>
            <Link
              href={`/jobs/${jobId}?tab=candidates`}
              className={pillClass(!activeStageId)}
            >
              <div className="text-[11px] uppercase tracking-wider opacity-70">All</div>
              <div className="text-lg font-semibold tabular-nums">{total}</div>
            </Link>
          </li>
          {funnel.map((s) => (
            <li key={s.stage_id}>
              <Link
                href={`/jobs/${jobId}?tab=candidates&stage=${s.stage_id}`}
                className={pillClass(activeStageId === s.stage_id)}
              >
                <div className="text-[11px] uppercase tracking-wider opacity-70">{s.stage_name}</div>
                <div className="text-lg font-semibold tabular-nums">{s.count}</div>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <CandidateTable rows={rows} />
    </div>
  );
}

function pillClass(active: boolean) {
  return [
    "flex min-w-[110px] flex-col items-center rounded-lg border px-4 py-2.5 transition-colors",
    active
      ? "border-primary bg-primary/10 text-foreground"
      : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground"
  ].join(" ");
}
