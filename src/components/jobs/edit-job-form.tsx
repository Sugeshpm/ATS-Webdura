"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { updateJob, saveJobTeam } from "@/app/(app)/jobs/actions";
import { JobTeamEditor, type JobTeamMember, type JobTeamSelection } from "@/components/jobs/job-team-editor";

type Option = { id: string; name: string };

export interface JobInitial {
  id: string;
  title: string;
  department_id: string | null;
  location_id: string | null;
  business_unit_id: string | null;
  description: string | null;
  skills: string[];
  employment_type: string | null;
  experience_min: number | null;
  experience_max: number | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  openings: number;
  priority: boolean;
  confidential: boolean;
  target_close_date: string | null;
  status: "draft" | "active" | "archived" | "closed";
  visibility: "internal" | "career_site" | "external" | "confidential";
}

interface Props {
  initial: JobInitial;
  initialTeam: JobTeamSelection;
  departments: Option[];
  locations: Option[];
  businessUnits: Option[];
  members: JobTeamMember[];
}

export function EditJobForm({ initial, initialTeam, departments, locations, businessUnits, members }: Props) {
  const router = useRouter();
  const [f, setF] = React.useState(initial);
  const [team, setTeam] = React.useState<JobTeamSelection>(initialTeam);
  const [skillInput, setSkillInput] = React.useState("");
  const [pending, setPending] = React.useState(false);

  function u<K extends keyof JobInitial>(k: K, v: JobInitial[K]) { setF((p) => ({ ...p, [k]: v })); }

  function addSkill() {
    const s = skillInput.trim();
    if (!s) return;
    if (!f.skills.includes(s)) u("skills", [...f.skills, s]);
    setSkillInput("");
  }
  function rmSkill(s: string) { u("skills", f.skills.filter((x) => x !== s)); }

  async function save() {
    if (!f.title.trim()) return toast.error("Title is required.");
    setPending(true);

    const { id, ...patch } = f;
    // 1. Persist the job fields.
    const jobResult = await updateJob(id, {
      ...patch,
      title: f.title.trim(),
      target_close_date: f.target_close_date || null
    });
    if (!jobResult.ok) {
      setPending(false);
      return toast.error(jobResult.error ?? "Update failed.");
    }

    // 2. Persist the hiring team (atomic replace via RPC).
    const teamResult = await saveJobTeam(id, team);
    setPending(false);
    if (!teamResult.ok) {
      // Job fields already saved — surface the error but don't discard the user's changes.
      return toast.error(`Job saved, but team update failed: ${teamResult.error}`);
    }

    toast.success("Saved.");
    router.push(`/jobs/${id}`);
    router.refresh();
  }

  return (
    <div className="container max-w-4xl py-6">
      <button
        onClick={() => router.back()}
        className="mb-3 inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Back
      </button>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Edit job</h1>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => router.back()} disabled={pending}>Cancel</Button>
          <Button onClick={save} disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle className="text-base">Basics</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="title">Job title *</Label>
            <Input id="title" value={f.title} onChange={(e) => u("title", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Department</Label>
            <Select value={f.department_id ?? ""} onValueChange={(v) => u("department_id", v || null)}>
              <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
              <SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Select value={f.location_id ?? ""} onValueChange={(v) => u("location_id", v || null)}>
              <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
              <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Business unit</Label>
            <Select value={f.business_unit_id ?? ""} onValueChange={(v) => u("business_unit_id", v || null)}>
              <SelectTrigger><SelectValue placeholder="Select business unit" /></SelectTrigger>
              <SelectContent>{businessUnits.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Employment type</Label>
            <Select value={f.employment_type ?? "full_time"} onValueChange={(v) => u("employment_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full_time">Full-time</SelectItem>
                <SelectItem value="part_time">Part-time</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
                <SelectItem value="intern">Intern</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader><CardTitle className="text-base">Compensation & openings</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Currency</Label>
            <Select value={f.salary_currency ?? "INR"} onValueChange={(v) => u("salary_currency", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="INR">INR</SelectItem><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem><SelectItem value="AED">AED</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Salary min</Label>
            <Input type="number" value={f.salary_min ?? ""} onChange={(e) => u("salary_min", e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div className="space-y-1.5">
            <Label>Salary max</Label>
            <Input type="number" value={f.salary_max ?? ""} onChange={(e) => u("salary_max", e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div className="space-y-1.5">
            <Label>Openings</Label>
            <Input type="number" min={1} value={f.openings} onChange={(e) => u("openings", Math.max(1, Number(e.target.value)))} />
          </div>
          <div className="space-y-1.5">
            <Label>Experience min (yrs)</Label>
            <Input type="number" value={f.experience_min ?? ""} onChange={(e) => u("experience_min", e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div className="space-y-1.5">
            <Label>Experience max (yrs)</Label>
            <Input type="number" value={f.experience_max ?? ""} onChange={(e) => u("experience_max", e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div className="space-y-1.5">
            <Label>Target close date</Label>
            <Input type="date" value={f.target_close_date ?? ""} onChange={(e) => u("target_close_date", e.target.value || null)} />
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader><CardTitle className="text-base">Visibility & flags</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={f.status} onValueChange={(v) => u("status", v as JobInitial["status"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Visibility</Label>
            <Select value={f.visibility} onValueChange={(v) => u("visibility", v as JobInitial["visibility"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="internal">Internal only</SelectItem>
                <SelectItem value="career_site">Career site</SelectItem>
                <SelectItem value="external">External boards</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2 md:col-span-1">
            <label className="flex items-center justify-between rounded-md border border-input px-3 py-2 text-sm">
              Priority<Switch checked={f.priority} onCheckedChange={(v) => u("priority", v)} />
            </label>
            <label className="flex items-center justify-between rounded-md border border-input px-3 py-2 text-sm">
              Confidential<Switch checked={f.confidential} onCheckedChange={(v) => u("confidential", v)} />
            </label>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader><CardTitle className="text-base">Description & skills</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Description</Label>
            <RichTextEditor
              value={f.description ?? ""}
              onChange={(html) => u("description", html)}
              placeholder="Describe the role, responsibilities, requirements…"
              minHeight={240}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Skills</Label>
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-input px-2 py-1.5">
              {f.skills.map((s) => (
                <span key={s} className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-xs">
                  {s}
                  <button onClick={() => rmSkill(s)} aria-label={`remove ${s}`}><X className="h-3 w-3" /></button>
                </span>
              ))}
              <input
                placeholder="Type and enter"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
                className="min-w-[160px] flex-1 bg-transparent px-1 text-sm focus:outline-none"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Hiring team</CardTitle>
          <p className="text-xs text-muted-foreground">
            Assign hiring managers, recruiters, and interviewers. Only active members of your organisation appear here.
            Changes take effect immediately after Save.
          </p>
        </CardHeader>
        <CardContent>
          <JobTeamEditor
            members={members}
            value={team}
            onChange={setTeam}
            disabled={pending}
          />
        </CardContent>
      </Card>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => router.back()} disabled={pending}>Cancel</Button>
        <Button onClick={save} disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
      </div>
    </div>
  );
}
