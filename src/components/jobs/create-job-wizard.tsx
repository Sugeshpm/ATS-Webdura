"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";

type Option = { id: string; name: string };
type Member = { id: string; first_name: string | null; last_name: string | null; email: string };

const STEPS = ["Job Description", "Job Details", "Hiring Team (Optional)", "Publish Options"] as const;

interface JobForm {
  title: string;
  department_id?: string;
  experience_range: string;
  description: string;
  skills: string[];
  employment_type: "full_time" | "part_time" | "contract" | "intern";
  location_id?: string;
  business_unit_id?: string;
  salary_min?: number;
  salary_max?: number;
  salary_currency: string;
  openings: number;
  priority: boolean;
  confidential: boolean;
  target_close_date?: string;
  hiring_manager_ids: string[];
  recruiter_ids: string[];
  interviewer_ids: string[];
  visibility: "internal" | "career_site" | "external" | "confidential";
}

const defaultForm: JobForm = {
  title: "",
  experience_range: "",
  description: "",
  skills: [],
  employment_type: "full_time",
  salary_currency: "INR",
  openings: 1,
  priority: false,
  confidential: false,
  hiring_manager_ids: [],
  recruiter_ids: [],
  interviewer_ids: [],
  visibility: "internal"
};

export function CreateJobWizard({
  departments, businessUnits, locations, members
}: { departments: Option[]; businessUnits: Option[]; locations: Option[]; members: Member[] }) {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [form, setForm] = React.useState<JobForm>(defaultForm);
  const [skillInput, setSkillInput] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const update = <K extends keyof JobForm>(k: K, v: JobForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  function addSkill() {
    const s = skillInput.trim();
    if (!s) return;
    if (!form.skills.includes(s)) update("skills", [...form.skills, s]);
    setSkillInput("");
  }
  function removeSkill(s: string) { update("skills", form.skills.filter((x) => x !== s)); }

  function toggleMember(field: "hiring_manager_ids" | "recruiter_ids" | "interviewer_ids", id: string) {
    const list = form[field];
    update(field, list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  function validate(): string | null {
    if (step === 0) {
      if (!form.title.trim()) return "Job title is required.";
      if (!form.department_id) return "Department is required.";
      if (!form.description.trim()) return "Job description is required.";
    }
    return null;
  }

  async function save(status: "draft" | "active") {
    const err = validate();
    if (err) { toast.error(err); return; }
    setPending(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user!.id).single();
    if (!profile) { setPending(false); return toast.error("Tenant not found."); }

    const { data: job, error } = await supabase.from("jobs").insert({
      tenant_id: profile.tenant_id,
      title: form.title.trim(),
      department_id: form.department_id ?? null,
      business_unit_id: form.business_unit_id ?? null,
      location_id: form.location_id ?? null,
      description: form.description,
      skills: form.skills,
      employment_type: form.employment_type,
      salary_min: form.salary_min ?? null,
      salary_max: form.salary_max ?? null,
      salary_currency: form.salary_currency,
      openings: form.openings,
      priority: form.priority,
      confidential: form.confidential,
      target_close_date: form.target_close_date ?? null,
      status,
      visibility: form.visibility,
      created_by: user!.id
    }).select("id").single();

    if (error || !job) { setPending(false); return toast.error(error?.message ?? "Failed to create job."); }

    const team = [
      ...form.hiring_manager_ids.map((id) => ({ job_id: job.id, user_id: id, role_on_job: "hiring_manager" })),
      ...form.recruiter_ids.map((id) => ({ job_id: job.id, user_id: id, role_on_job: "recruiter" })),
      ...form.interviewer_ids.map((id) => ({ job_id: job.id, user_id: id, role_on_job: "interviewer" }))
    ];
    if (team.length) {
      const { error: tErr } = await supabase.from("job_team").insert(team);
      if (tErr) toast.error("Job saved, but assigning team failed: " + tErr.message);
    }

    setPending(false);
    toast.success(status === "draft" ? "Draft saved." : "Job published.");
    router.push("/jobs");
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <h2 className="text-base font-semibold">Create Job Posting</h2>
        <button onClick={() => router.back()} aria-label="Close"><X className="h-5 w-5" /></button>
      </header>

      <div className="flex items-center justify-center gap-6 border-b border-border bg-card/40 px-6 py-3 text-xs">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <span className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold",
              i === step ? "border-primary text-primary" :
              i < step  ? "border-emerald-500 bg-emerald-500/15 text-emerald-300" : "border-border text-muted-foreground"
            )}>{i + 1}</span>
            <span className={cn("font-medium uppercase tracking-wide", i === step ? "text-foreground" : "text-muted-foreground")}>{label}</span>
            {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        ))}

        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => save("draft")} disabled={pending}>Save Draft</Button>
          {step < STEPS.length - 1 ? (
            <Button size="sm" onClick={() => {
              const err = validate(); if (err) return toast.error(err);
              setStep((s) => s + 1);
            }}>Continue</Button>
          ) : (
            <Button size="sm" onClick={() => save("active")} disabled={pending}>Publish</Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-4xl">
          {step === 0 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="md:col-span-1">
                  <Label htmlFor="title">Job title <span className="text-rose-400">*</span></Label>
                  <Input id="title" placeholder="Start typing job title" value={form.title} onChange={(e) => update("title", e.target.value)} />
                </div>
                <div>
                  <Label>Department <span className="text-rose-400">*</span></Label>
                  <Select value={form.department_id} onValueChange={(v) => update("department_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="exp">Experience range</Label>
                  <Input id="exp" placeholder="Ex: 2 - 4 years" value={form.experience_range} onChange={(e) => update("experience_range", e.target.value)} />
                </div>
              </div>

              <div>
                <Label>Job description <span className="text-rose-400">*</span></Label>
                <RichTextEditor
                  value={form.description}
                  onChange={(html) => update("description", html)}
                  placeholder="Describe the role, responsibilities, requirements…"
                  minHeight={280}
                />
              </div>

              <div>
                <Label>Skills</Label>
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-input px-2 py-1.5">
                  {form.skills.map((s) => (
                    <span key={s} className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-xs">
                      {s}
                      <button onClick={() => removeSkill(s)} aria-label={`remove ${s}`}><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                  <input
                    placeholder="Type and enter skills here"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
                    className="min-w-[160px] flex-1 bg-transparent px-1 text-sm focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <Label>Employment type</Label>
                  <Select value={form.employment_type} onValueChange={(v) => update("employment_type", v as JobForm["employment_type"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_time">Full-time</SelectItem>
                      <SelectItem value="part_time">Part-time</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="intern">Intern</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Location</Label>
                  <Select value={form.location_id} onValueChange={(v) => update("location_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                    <SelectContent>
                      {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Business unit</Label>
                  <Select value={form.business_unit_id} onValueChange={(v) => update("business_unit_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Select business unit" /></SelectTrigger>
                    <SelectContent>
                      {businessUnits.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div>
                  <Label>Currency</Label>
                  <Select value={form.salary_currency} onValueChange={(v) => update("salary_currency", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INR">INR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="AED">AED</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="smin">Salary min</Label>
                  <Input id="smin" type="number" value={form.salary_min ?? ""} onChange={(e) => update("salary_min", e.target.value ? Number(e.target.value) : undefined)} />
                </div>
                <div>
                  <Label htmlFor="smax">Salary max</Label>
                  <Input id="smax" type="number" value={form.salary_max ?? ""} onChange={(e) => update("salary_max", e.target.value ? Number(e.target.value) : undefined)} />
                </div>
                <div>
                  <Label htmlFor="op">Openings</Label>
                  <Input id="op" type="number" min={1} value={form.openings} onChange={(e) => update("openings", Math.max(1, Number(e.target.value)))} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="tcd">Target close date</Label>
                  <Input id="tcd" type="date" value={form.target_close_date ?? ""} onChange={(e) => update("target_close_date", e.target.value)} />
                </div>
                <label className="flex items-center justify-between rounded-md border border-input px-3 py-2 text-sm">
                  Priority
                  <Switch checked={form.priority} onCheckedChange={(v) => update("priority", v)} />
                </label>
                <label className="flex items-center justify-between rounded-md border border-input px-3 py-2 text-sm">
                  Confidential
                  <Switch checked={form.confidential} onCheckedChange={(v) => update("confidential", v)} />
                </label>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-6 md:grid-cols-3">
              <MemberList title="Hiring Manager" members={members} selected={form.hiring_manager_ids} onToggle={(id) => toggleMember("hiring_manager_ids", id)} />
              <MemberList title="Recruiters" members={members} selected={form.recruiter_ids} onToggle={(id) => toggleMember("recruiter_ids", id)} />
              <MemberList title="Interviewers" members={members} selected={form.interviewer_ids} onToggle={(id) => toggleMember("interviewer_ids", id)} />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Choose where this job is visible.</p>
              {([
                { v: "internal",     label: "Internal only", help: "Visible only to team members in this app." },
                { v: "career_site",  label: "Career site",   help: "Published on your public career page." },
                { v: "external",     label: "External boards",help: "Career site + selected external job boards (configure in Apps)." }
              ] as const).map(({ v, label, help }) => (
                <label key={v} className="flex cursor-pointer items-start gap-3 rounded-md border border-input p-3">
                  <input type="radio" name="visibility" className="mt-1" checked={form.visibility === v} onChange={() => update("visibility", v)} />
                  <div>
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground">{help}</div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MemberList({ title, members, selected, onToggle }: { title: string; members: Member[]; selected: string[]; onToggle: (id: string) => void }) {
  return (
    <div className="rounded-md border border-border p-3">
      <h4 className="mb-2 text-sm font-semibold">{title}</h4>
      <ul className="space-y-1.5 max-h-72 overflow-y-auto">
        {members.map((m) => (
          <li key={m.id}>
            <label className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-secondary/50">
              <input type="checkbox" checked={selected.includes(m.id)} onChange={() => onToggle(m.id)} />
              <span className="flex-1">{`${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || m.email}</span>
              <span className="text-xs text-muted-foreground">{m.email}</span>
            </label>
          </li>
        ))}
        {members.length === 0 && <li className="text-xs text-muted-foreground">Invite people from Settings → Users.</li>}
      </ul>
    </div>
  );
}
