"use client";
import Link from "next/link";
import { MoreHorizontal, Mail, Phone } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDate, initials } from "@/lib/utils";

export type CandidateRow = {
  application_id: string;
  candidate_id: string;
  first_name: string;
  last_name: string | null;
  job_title: string | null;
  stage_name: string | null;
  experience_years: number | null;
  experience_months: number | null;
  applied_at: string;
  updated_at: string;
  source: string | null;
  email: string | null;
  phone: string | null;
  preferred_location: string | null;
  current_company: string | null;
  gender: string | null;
};

export function CandidateTable({ rows }: { rows: CandidateRow[] }) {
  if (!rows.length) {
    return (
      <div className="rounded-md border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        No candidates yet. Click <span className="font-medium text-foreground">+ Add Candidate</span> to get started.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="min-w-full text-sm">
        <thead className="bg-secondary/50 text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <Th className="w-8 pl-3"><Checkbox /></Th>
            <Th>Candidate name</Th>
            <Th>Job title</Th>
            <Th>Stage</Th>
            <Th>Experience</Th>
            <Th>Last updated</Th>
            <Th>Tags</Th>
            <Th>Source</Th>
            <Th>Application date</Th>
            <Th>Previous company</Th>
            <Th>Preferred location</Th>
            <Th>Gender</Th>
            <Th>Contact</Th>
            <Th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.application_id} className="border-t border-border hover:bg-secondary/30">
              <Td className="pl-3"><Checkbox /></Td>
              <Td>
                <Link href={`/candidates/${r.application_id}`} className="flex items-center gap-2 hover:underline">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-[10px]">{initials(r.first_name, r.last_name)}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{r.first_name} {r.last_name ?? ""}</span>
                </Link>
              </Td>
              <Td>{r.job_title ?? "—"}</Td>
              <Td>
                {r.stage_name ? <Badge>{r.stage_name}</Badge> : "—"}
              </Td>
              <Td>{r.experience_years ?? 0}y {r.experience_months ?? 0}m</Td>
              <Td>{formatDate(r.updated_at)}</Td>
              <Td className="text-muted-foreground">Not Available</Td>
              <Td>{r.source ?? "—"}</Td>
              <Td>{formatDate(r.applied_at)}</Td>
              <Td>{r.current_company ?? "Not Available"}</Td>
              <Td>{r.preferred_location ?? "Not Available"}</Td>
              <Td>{r.gender ?? "—"}</Td>
              <Td>
                <div className="flex flex-col gap-0.5 text-xs">
                  {r.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{r.phone}</span>}
                  {r.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{r.email}</span>}
                </div>
              </Td>
              <Td><button className="rounded p-1 hover:bg-secondary"><MoreHorizontal className="h-4 w-4" /></button></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ className, children }: React.HTMLAttributes<HTMLTableCellElement>) {
  return <th className={"whitespace-nowrap px-3 py-2 text-left font-semibold " + (className ?? "")}>{children}</th>;
}
function Td({ className, children }: React.HTMLAttributes<HTMLTableCellElement>) {
  return <td className={"whitespace-nowrap px-3 py-2 " + (className ?? "")}>{children}</td>;
}
