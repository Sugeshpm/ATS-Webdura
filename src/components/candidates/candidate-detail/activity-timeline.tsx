import { UserPlus, ArrowRight, StickyNote, FileText, CalendarPlus, Mail } from "lucide-react";
import { formatDate } from "@/lib/utils";

export type ActivityEntry =
  | { kind: "created"; at: string; actorName?: string }
  | { kind: "stage_change"; at: string; from: string | null; to: string; actorName?: string; comment?: string | null }
  | { kind: "note"; at: string; actorName?: string; body: string }
  | { kind: "document"; at: string; actorName?: string; name: string; documentKind: string }
  | { kind: "interview"; at: string; actorName?: string; status: string; scheduled_start: string }
  | { kind: "email"; at: string; actorName?: string; subject: string };

interface Props {
  entries: ActivityEntry[];
}

export function ActivityTimeline({ entries }: Props) {
  if (!entries.length) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
        No activity yet. Stage moves, notes, uploads, and interviews will show up here.
      </div>
    );
  }

  return (
    <ol className="relative space-y-5 border-l border-border pl-6">
      {entries.map((e, i) => {
        const { Icon, tone } = iconFor(e.kind);
        return (
          <li key={i} className="relative">
            <span
              className="absolute -left-[33px] flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-background"
              style={{ background: `color-mix(in srgb, ${tone} 25%, transparent)`, color: tone }}
            >
              <Icon className="h-3 w-3" />
            </span>
            <div className="rounded-lg border border-border bg-card px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <Description e={e} />
                <span className="text-[11px] text-muted-foreground">{formatDate(e.at, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              {e.kind === "stage_change" && e.comment && (
                <p className="mt-1 text-xs text-muted-foreground">&ldquo;{e.comment}&rdquo;</p>
              )}
              {e.kind === "note" && (
                <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground line-clamp-3">{e.body}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Description({ e }: { e: ActivityEntry }) {
  const actor = e.actorName ? <span className="font-medium">{e.actorName}</span> : <span className="text-muted-foreground">Someone</span>;
  switch (e.kind) {
    case "created":      return <span>{actor} <span className="text-muted-foreground">added the candidate</span></span>;
    case "stage_change": return <span>{actor} <span className="text-muted-foreground">moved stage from</span> <code className="rounded bg-secondary px-1.5 py-0.5 text-[11px]">{e.from ?? "—"}</code> <ArrowRight className="inline h-3 w-3 mx-0.5 opacity-60" /> <code className="rounded bg-secondary px-1.5 py-0.5 text-[11px]">{e.to}</code></span>;
    case "note":         return <span>{actor} <span className="text-muted-foreground">added a note</span></span>;
    case "document":     return <span>{actor} <span className="text-muted-foreground">uploaded</span> <span className="font-medium">{e.name}</span> <span className="text-muted-foreground">({e.documentKind})</span></span>;
    case "interview":    return <span>{actor} <span className="text-muted-foreground">scheduled an interview for {formatDate(e.scheduled_start)} ({e.status})</span></span>;
    case "email":        return <span>{actor} <span className="text-muted-foreground">sent email:</span> <span className="font-medium">{e.subject}</span></span>;
  }
}

function iconFor(kind: ActivityEntry["kind"]) {
  switch (kind) {
    case "created":      return { Icon: UserPlus,    tone: "hsl(160 70% 50%)" };
    case "stage_change": return { Icon: ArrowRight,  tone: "hsl(265 80% 65%)" };
    case "note":         return { Icon: StickyNote,  tone: "hsl(45 90% 60%)" };
    case "document":     return { Icon: FileText,    tone: "hsl(8 81% 56%)" };
    case "interview":    return { Icon: CalendarPlus,tone: "hsl(200 80% 60%)" };
    case "email":        return { Icon: Mail,        tone: "hsl(140 60% 55%)" };
  }
}
