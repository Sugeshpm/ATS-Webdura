"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Phone, Trash2, X, Columns3, ChevronLeft, ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge, stageBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem
} from "@/components/ui/dropdown-menu";
import { formatDate, initials, cn } from "@/lib/utils";
import { deleteCandidates, type CandidateCategory } from "@/app/(app)/candidates/actions";
import { MoveToMenu } from "@/components/candidates/move-to-menu";

export type CandidateRow = {
  application_id: string | null;
  candidate_id: string;
  first_name: string;
  last_name: string | null;
  job_title: string | null;
  stage_name: string | null;
  experience_years: number | null;
  experience_months: number | null;
  applied_at: string | null;
  updated_at: string;
  source: string | null;
  email: string | null;
  phone: string | null;
  preferred_location: string | null;
  current_company: string | null;
  gender: string | null;
  category: CandidateCategory;
};

const AVATAR_TONES = [
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
  "bg-orange-100 text-orange-700"
];

function avatarTone(seed: string) {
  let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

// ---------------------------------------------------------------------------
// Column model — drives both the header and the body, and the visibility menu.
// ---------------------------------------------------------------------------
type ColumnKey =
  | "candidate" | "job_title" | "stage" | "category" | "experience"
  | "updated" | "contact" | "current_company" | "preferred_location" | "source" | "applied";

interface ColumnDef {
  key: ColumnKey;
  label: string;
  defaultVisible: boolean;
  alwaysOn?: boolean;
  cellClassName?: string;
  headClassName?: string;
  render: (r: CandidateRow) => React.ReactNode;
}

const COLUMNS: ColumnDef[] = [
  {
    key: "candidate", label: "Candidate", defaultVisible: true, alwaysOn: true,
    render: (r) => {
      const inner = (
        <>
          <Avatar className="h-8 w-8 ring-1 ring-border">
            <AvatarFallback className={cn("text-[11px] font-semibold", avatarTone(r.candidate_id))}>
              {initials(r.first_name, r.last_name)}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium">{r.first_name} {r.last_name ?? ""}</span>
        </>
      );
      return r.application_id ? (
        <Link href={`/candidates/${r.application_id}`} className="flex items-center gap-2.5 hover:text-primary">{inner}</Link>
      ) : (
        <div className="flex items-center gap-2.5">{inner}</div>
      );
    }
  },
  {
    key: "job_title", label: "Job title", defaultVisible: true, cellClassName: "max-w-[180px] truncate",
    render: (r) => r.job_title ?? <span className="text-muted-foreground">—</span>
  },
  {
    key: "stage", label: "Stage", defaultVisible: true,
    render: (r) => r.stage_name ? <Badge variant={stageBadgeVariant(r.stage_name)}>{r.stage_name}</Badge> : <span className="text-muted-foreground">—</span>
  },
  {
    key: "category", label: "Category", defaultVisible: true,
    render: (r) => <CategoryBadge value={r.category} />
  },
  {
    key: "experience", label: "Experience", defaultVisible: true, cellClassName: "text-foreground/80",
    render: (r) => <>{r.experience_years ?? 0}y {r.experience_months ?? 0}m</>
  },
  {
    key: "contact", label: "Contact", defaultVisible: true,
    render: (r) => (
      <div className="flex flex-col gap-0.5 text-xs leading-tight">
        {r.phone && <span className="inline-flex items-center gap-1 text-foreground/80"><Phone className="h-3 w-3 text-muted-foreground" />{r.phone}</span>}
        {r.email && <span className="inline-flex items-center gap-1 text-muted-foreground" title={r.email}><Mail className="h-3 w-3" />{truncate(r.email, 22)}</span>}
        {!r.phone && !r.email && <span className="text-muted-foreground">—</span>}
      </div>
    )
  },
  {
    key: "updated", label: "Last updated", defaultVisible: true, cellClassName: "text-muted-foreground",
    render: (r) => formatDate(r.updated_at)
  },
  {
    key: "current_company", label: "Previous company", defaultVisible: false, cellClassName: "max-w-[160px] truncate text-foreground/80",
    render: (r) => r.current_company ?? <span className="text-muted-foreground">Not available</span>
  },
  {
    key: "preferred_location", label: "Preferred location", defaultVisible: false, cellClassName: "max-w-[160px] truncate text-foreground/80",
    render: (r) => r.preferred_location ?? <span className="text-muted-foreground">Not available</span>
  },
  {
    key: "source", label: "Source", defaultVisible: false, cellClassName: "text-muted-foreground",
    render: (r) => r.source ?? "—"
  },
  {
    key: "applied", label: "Applied", defaultVisible: false, cellClassName: "text-muted-foreground",
    render: (r) => r.applied_at ? formatDate(r.applied_at) : "—"
  }
];

const STORAGE_KEY = "ats.candidates.columns.v1";
const PAGE_SIZES = [10, 25, 50, 100];

export function CandidateTable({ rows }: { rows: CandidateRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  // Column visibility — persisted per browser.
  const [visible, setVisible] = React.useState<Set<ColumnKey>>(
    () => new Set(COLUMNS.filter((c) => c.alwaysOn || c.defaultVisible).map((c) => c.key))
  );
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const next = new Set(JSON.parse(raw) as ColumnKey[]);
      for (const c of COLUMNS) if (c.alwaysOn) next.add(c.key);
      setVisible(next);
    } catch { /* ignore */ }
  }, []);

  function toggleCol(key: ColumnKey) {
    setVisible((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...n])); } catch { /* ignore */ }
      return n;
    });
  }

  const visibleColumns = COLUMNS.filter((c) => visible.has(c.key));

  // Pagination
  const [pageSize, setPageSize] = React.useState(25);
  const [page, setPage] = React.useState(0);
  React.useEffect(() => { setPage(0); }, [rows, pageSize]);

  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * pageSize;
  const pagedRows = rows.slice(start, start + pageSize);
  const pageIds = pagedRows.map((r) => r.candidate_id);

  function toggle(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    setSelected((prev) => {
      const n = new Set(prev);
      pageIds.every((id) => n.has(id)) ? pageIds.forEach((id) => n.delete(id)) : pageIds.forEach((id) => n.add(id));
      return n;
    });
  }
  function clear() { setSelected(new Set()); }

  async function bulkDelete() {
    setPending(true);
    const result = await deleteCandidates(Array.from(selected));
    setPending(false);
    if (!result.ok) return toast.error(result.error ?? "Delete failed.");
    toast.success(`Deleted ${result.deleted} candidate${result.deleted === 1 ? "" : "s"}.`);
    setConfirmOpen(false);
    clear();
    router.refresh();
  }

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-white p-12 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
          <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="7" r="4" /><path d="M5 21v-2a7 7 0 0114 0v2" /></svg>
        </div>
        <h3 className="text-sm font-semibold">No candidates here yet</h3>
        <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
          Add candidates via the &ldquo;+ Add Candidate&rdquo; button, import from CSV, or move existing candidates into this category.
        </p>
      </div>
    );
  }

  const allChecked = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  return (
    <>
      {/* Toolbar */}
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {total} candidate{total === 1 ? "" : "s"}
          {selected.size > 0 && <span className="text-foreground"> · {selected.size} selected</span>}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Columns3 className="mr-1.5 h-4 w-4" /> Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {COLUMNS.filter((c) => !c.alwaysOn).map((c) => (
              <DropdownMenuCheckboxItem
                key={c.key}
                checked={visible.has(c.key)}
                onCheckedChange={() => toggleCol(c.key)}
                onSelect={(e) => e.preventDefault()}
              >
                {c.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-white shadow-card">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-sunken text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <tr>
              <Th className="w-10 pl-4">
                <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Select all on page" />
              </Th>
              {visibleColumns.map((c) => (
                <Th key={c.key} className={c.headClassName}>{c.label}</Th>
              ))}
              <Th className="w-12 pr-4 text-right">Actions</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pagedRows.map((r) => {
              const isSelected = selected.has(r.candidate_id);
              return (
                <tr
                  key={r.application_id ?? r.candidate_id}
                  className={cn("group h-14 transition-colors", isSelected ? "bg-primary/5" : "hover:bg-secondary/40")}
                >
                  <Td className="pl-4">
                    <Checkbox checked={isSelected} onCheckedChange={() => toggle(r.candidate_id)} aria-label="Select row" />
                  </Td>
                  {visibleColumns.map((c) => (
                    <Td key={c.key} className={c.cellClassName}>{c.render(r)}</Td>
                  ))}
                  <Td className="pr-4 text-right">
                    <MoveToMenu candidateIds={[r.candidate_id]} currentCategory={r.category} variant="icon" />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs">
          <span className="text-muted-foreground">
            Showing <span className="font-medium text-foreground">{total === 0 ? 0 : start + 1}</span>–
            <span className="font-medium text-foreground">{Math.min(start + pageSize, total)}</span> of{" "}
            <span className="font-medium text-foreground">{total}</span>
          </span>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-muted-foreground">
              Rows per page
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="h-8 rounded-md border border-input bg-white px-2 text-xs"
              >
                {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setPage(safePage - 1)} disabled={safePage <= 0} aria-label="Previous page">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[5.5rem] text-center text-muted-foreground">Page {safePage + 1} of {pageCount}</span>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setPage(safePage + 1)} disabled={safePage >= pageCount - 1} aria-label="Next page">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="fixed inset-x-4 bottom-4 z-40 mx-auto flex w-fit max-w-[calc(100vw-2rem)] flex-wrap items-center gap-3 rounded-full border border-border bg-white px-4 py-2 shadow-card-hover ring-1 ring-black/5">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button variant="ghost" size="sm" onClick={clear} aria-label="Clear selection" className="h-7 w-7 p-0">
            <X className="h-4 w-4" />
          </Button>
          <span className="h-5 w-px bg-border" />
          <MoveToMenu candidateIds={Array.from(selected)} variant="button" onMoved={clear} />
          <Button variant="destructive" size="sm" onClick={() => setConfirmOpen(true)}>
            <Trash2 className="mr-1 h-4 w-4" /> Delete
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete ${selected.size} candidate${selected.size === 1 ? "" : "s"}?`}
        description="Every linked application, interview, feedback note, document, and message will be removed too. This cannot be undone."
        confirmLabel="Delete candidates"
        destructive
        pending={pending}
        onConfirm={bulkDelete}
      />
    </>
  );
}

export function CategoryBadge({ value }: { value: CandidateCategory }) {
  switch (value) {
    case "active":      return <Badge variant="success">Active</Badge>;
    case "talent_pool": return <Badge variant="info">Talent Pool</Badge>;
    case "archived":    return <Badge variant="offline">Archived</Badge>;
    case "duplicate":   return <Badge variant="warning">Duplicate</Badge>;
  }
}

function Th({ className, children }: React.HTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("whitespace-nowrap px-3 py-3 text-left", className)}>{children}</th>;
}
function Td({ className, children, title }: React.HTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("whitespace-nowrap px-3 py-2.5 align-middle", className)} title={title}>{children}</td>;
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
