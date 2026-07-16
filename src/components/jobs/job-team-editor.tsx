"use client";
import * as React from "react";
import { Search, Users, User, UserCheck, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials, cn } from "@/lib/utils";

export type JobTeamMember = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  /** Optional so callers that don't join `role` can still pass rows through. */
  role?: string | null;
};

export interface JobTeamSelection {
  hiring_manager_ids: string[];
  recruiter_ids: string[];
  interviewer_ids: string[];
}

interface Props {
  members: JobTeamMember[];
  value: JobTeamSelection;
  onChange: (next: JobTeamSelection) => void;
  disabled?: boolean;
}

/**
 * 3-column picker (Hiring Manager / Recruiters / Interviewers).
 *
 * Same shape is used by both the Create Job wizard and the Edit Job form so
 * behaviour stays identical. Members list is filtered by tenant + status server-side
 * (only approved users appear here); the component treats `members` as authoritative.
 */
export function JobTeamEditor({ members, value, onChange, disabled = false }: Props) {
  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <MemberList
        title="Hiring Managers"
        icon={UserCheck}
        members={members}
        selected={value.hiring_manager_ids}
        disabled={disabled}
        onToggle={(id) => onChange({ ...value, hiring_manager_ids: toggle(value.hiring_manager_ids, id) })}
        onClear={() => onChange({ ...value, hiring_manager_ids: [] })}
      />
      <MemberList
        title="Recruiters"
        icon={Users}
        members={members}
        selected={value.recruiter_ids}
        disabled={disabled}
        onToggle={(id) => onChange({ ...value, recruiter_ids: toggle(value.recruiter_ids, id) })}
        onClear={() => onChange({ ...value, recruiter_ids: [] })}
      />
      <MemberList
        title="Interviewers"
        icon={User}
        members={members}
        selected={value.interviewer_ids}
        disabled={disabled}
        onToggle={(id) => onChange({ ...value, interviewer_ids: toggle(value.interviewer_ids, id) })}
        onClear={() => onChange({ ...value, interviewer_ids: [] })}
      />
    </div>
  );
}

interface MemberListProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  members: JobTeamMember[];
  selected: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
  disabled?: boolean;
}

function MemberList({ title, icon: Icon, members, selected, onToggle, onClear, disabled }: MemberListProps) {
  const [q, setQ] = React.useState("");

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((m) =>
      `${m.first_name ?? ""} ${m.last_name ?? ""}`.toLowerCase().includes(needle) ||
      m.email.toLowerCase().includes(needle)
    );
  }, [members, q]);

  const selectedMembers = React.useMemo(
    () => members.filter((m) => selected.includes(m.id)),
    [members, selected]
  );

  return (
    <div className="rounded-md border border-border">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <h4 className="inline-flex items-center gap-2 text-sm font-semibold">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
          <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
            {selected.length}
          </span>
        </h4>
        {selected.length > 0 && !disabled && (
          <button
            onClick={onClear}
            className="text-[11px] text-muted-foreground hover:text-foreground"
            title={`Remove all ${title.toLowerCase()}`}
          >
            Clear
          </button>
        )}
      </div>

      {/* Selected chips */}
      {selectedMembers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-border px-3 py-2">
          {selectedMembers.map((m) => (
            <span
              key={m.id}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 pl-1 pr-2 py-0.5 text-[11px] text-primary"
            >
              <Avatar className="h-4 w-4">
                <AvatarFallback className="text-[8px]">{initials(m.first_name, m.last_name)}</AvatarFallback>
              </Avatar>
              {(`${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || m.email).split(" ")[0]}
              {!disabled && (
                <button onClick={() => onToggle(m.id)} aria-label={`Remove ${m.email}`}>
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Search */}
      <label className="flex items-center border-b border-border px-3 py-2">
        <Search className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search members"
          className="h-6 w-full bg-transparent text-xs focus:outline-none"
        />
      </label>

      <ul className="max-h-64 space-y-0.5 overflow-y-auto p-1.5">
        {filtered.map((m) => {
          const isSelected = selected.includes(m.id);
          const name = `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || m.email;
          return (
            <li key={m.id}>
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors",
                  isSelected ? "bg-primary/10" : "hover:bg-secondary/60",
                  disabled && "cursor-not-allowed opacity-60"
                )}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggle(m.id)}
                  disabled={disabled}
                  className="h-3.5 w-3.5 rounded border-input"
                />
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-[10px]">{initials(m.first_name, m.last_name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{name}</div>
                  <div className="truncate text-[10px] text-muted-foreground">{m.email}</div>
                </div>
              </label>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="px-2 py-4 text-center text-xs text-muted-foreground">
            {members.length === 0
              ? "No approved members. Invite people via Settings → Users."
              : "No matches for your search."}
          </li>
        )}
      </ul>
    </div>
  );
}
