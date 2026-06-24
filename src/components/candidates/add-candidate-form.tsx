"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload, X } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";

interface Props {
  jobs: { id: string; title: string }[];
  stages: { id: string; name: string; code: string }[];
  onDone: () => void;
}

interface CandidateForm {
  job_id?: string;
  resume?: File;
  first_name: string;
  middle_name: string;
  last_name: string;
  mobile_country: string;
  mobile: string;
  email: string;
  stage_id?: string;
  source: string;
  owner_id?: string;
  gender: string;
  dob: string;
  current_salary_currency: string;
  current_salary?: number;
  current_salary_na: boolean;
  experience_years?: number;
  experience_months?: number;
  expected_salary_currency: string;
  expected_salary?: number;
  expected_salary_na: boolean;
  available_to_join_days?: number;
  preferred_location: string;
  current_location: string;
  skills: string[];
}

const defaults: CandidateForm = {
  first_name: "", middle_name: "", last_name: "",
  mobile_country: "+91", mobile: "",
  email: "",
  source: "linkedin",
  gender: "",
  dob: "",
  current_salary_currency: "INR", current_salary_na: false,
  expected_salary_currency: "INR", expected_salary_na: false,
  preferred_location: "", current_location: "",
  skills: []
};

export function AddCandidateForm({ jobs, stages, onDone }: Props) {
  const router = useRouter();
  const [f, setF] = React.useState<CandidateForm>(defaults);
  const [skillInput, setSkillInput] = React.useState("");
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    const sourced = stages.find((s) => s.code === "sourced");
    if (sourced) setF((p) => ({ ...p, stage_id: sourced.id }));
  }, [stages]);

  const u = <K extends keyof CandidateForm>(k: K, v: CandidateForm[K]) => setF((p) => ({ ...p, [k]: v }));

  const onDrop = React.useCallback((accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Resume must be ≤ 10 MB."); return; }
    u("resume", file);
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: { "application/pdf": [".pdf"], "application/msword": [".doc"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] }
  });

  function addSkill() {
    const s = skillInput.trim();
    if (!s) return;
    if (!f.skills.includes(s)) u("skills", [...f.skills, s]);
    setSkillInput("");
  }
  function rmSkill(s: string) { u("skills", f.skills.filter((x) => x !== s)); }

  async function submit() {
    if (!f.job_id) return toast.error("Choose the job this candidate applies to.");
    if (!f.first_name.trim()) return toast.error("First name is required.");
    if (!f.email.trim() && !f.mobile.trim()) return toast.error("Email or mobile is required.");

    setPending(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user!.id).single();
    if (!profile) { setPending(false); return toast.error("Tenant not found."); }
    const tenant_id = profile.tenant_id;

    // 1. Insert candidate
    const { data: candidate, error: cErr } = await supabase.from("candidates").insert({
      tenant_id,
      first_name: f.first_name.trim(),
      middle_name: f.middle_name.trim() || null,
      last_name: f.last_name.trim() || null,
      email: f.email.trim() || null,
      phone: f.mobile.trim() ? `${f.mobile_country} ${f.mobile.trim()}` : null,
      gender: f.gender || null,
      date_of_birth: f.dob || null,
      preferred_location: f.preferred_location || null,
      current_location: f.current_location || null,
      current_salary: f.current_salary_na ? null : f.current_salary ?? null,
      current_salary_currency: f.current_salary_currency,
      expected_salary: f.expected_salary_na ? null : f.expected_salary ?? null,
      expected_salary_currency: f.expected_salary_currency,
      experience_years: f.experience_years ?? 0,
      experience_months: f.experience_months ?? 0,
      notice_period_days: f.available_to_join_days ?? null,
      source: f.source,
      owner_id: f.owner_id ?? user!.id
    }).select("id").single();

    if (cErr || !candidate) { setPending(false); return toast.error(cErr?.message ?? "Failed to add candidate."); }

    // 2. Upload resume if provided
    if (f.resume) {
      const path = `${tenant_id}/${candidate.id}/${Date.now()}-${f.resume.name}`;
      const { error: upErr } = await supabase.storage.from("resumes").upload(path, f.resume);
      if (!upErr) {
        await supabase.from("documents").insert({
          tenant_id, candidate_id: candidate.id, kind: "resume", name: f.resume.name,
          mime: f.resume.type, size_bytes: f.resume.size,
          storage_bucket: "resumes", storage_path: path, uploaded_by: user!.id
        });
      }
    }

    // 3. Skills
    if (f.skills.length) {
      const { data: existing } = await supabase.from("skills").select("id, name").eq("tenant_id", tenant_id).in("name", f.skills);
      const haveNames = new Set((existing ?? []).map((s) => s.name.toLowerCase()));
      const toInsert = f.skills.filter((s) => !haveNames.has(s.toLowerCase()));
      let inserted: { id: string; name: string }[] = [];
      if (toInsert.length) {
        const { data: ins } = await supabase.from("skills").insert(toInsert.map((name) => ({ tenant_id, name }))).select("id, name");
        inserted = ins ?? [];
      }
      const allSkillIds = [...(existing ?? []), ...inserted].map((s) => s.id);
      if (allSkillIds.length) {
        await supabase.from("candidate_skills").insert(allSkillIds.map((skill_id) => ({ candidate_id: candidate.id, skill_id })));
      }
    }

    // 4. Application
    const { error: aErr } = await supabase.from("applications").insert({
      tenant_id, candidate_id: candidate.id, job_id: f.job_id,
      current_stage_id: f.stage_id ?? null,
      applied_via: "manual",
      created_by: user!.id
    });
    if (aErr) { setPending(false); return toast.error("Candidate saved but application link failed: " + aErr.message); }

    toast.success("Candidate added.");
    setPending(false);
    onDone();
    router.refresh();
  }

  return (
    <div className="mt-4 space-y-5 pb-24">
      <div>
        <Label>Job which this candidate belongs to</Label>
        <Select value={f.job_id} onValueChange={(v) => u("job_id", v)}>
          <SelectTrigger><SelectValue placeholder="Select a job" /></SelectTrigger>
          <SelectContent>{jobs.map((j) => <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div
        {...getRootProps()}
        className={"flex flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center text-sm " +
          (isDragActive ? "border-primary bg-primary/5" : "border-border")}
      >
        <input {...getInputProps()} />
        <Upload className="mb-2 h-5 w-5 text-muted-foreground" />
        {f.resume ? (
          <div className="flex items-center gap-2">
            <span>{f.resume.name}</span>
            <button onClick={(e) => { e.stopPropagation(); u("resume", undefined); }} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
          </div>
        ) : (
          <>
            <p>Drag and drop resume here or <span className="text-primary">select from computer</span></p>
            <p className="mt-1 text-xs text-muted-foreground">You can upload file upto 10MB</p>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="First Name" required>
          <Input value={f.first_name} onChange={(e) => u("first_name", e.target.value)} placeholder="First name" />
        </Field>
        <Field label="Middle Name">
          <Input value={f.middle_name} onChange={(e) => u("middle_name", e.target.value)} placeholder="Middle name" />
        </Field>
        <Field label="Last Name">
          <Input value={f.last_name} onChange={(e) => u("last_name", e.target.value)} placeholder="Last name" />
        </Field>
        <Field label="Mobile">
          <div className="flex">
            <input value={f.mobile_country} onChange={(e) => u("mobile_country", e.target.value)} className="h-9 w-16 rounded-l-md border border-r-0 border-input bg-transparent px-2 text-sm focus:outline-none" />
            <Input value={f.mobile} onChange={(e) => u("mobile", e.target.value)} placeholder="Mobile number" className="rounded-l-none" />
          </div>
        </Field>
        <Field label="Email">
          <Input type="email" value={f.email} onChange={(e) => u("email", e.target.value)} placeholder="Ex: john@example.com" />
        </Field>
        <Field label="Stage">
          <Select value={f.stage_id} onValueChange={(v) => u("stage_id", v)}>
            <SelectTrigger><SelectValue placeholder="Stage" /></SelectTrigger>
            <SelectContent>{stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Source">
          <Select value={f.source} onValueChange={(v) => u("source", v)}>
            <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="linkedin">LinkedIn</SelectItem>
              <SelectItem value="indeed">Indeed</SelectItem>
              <SelectItem value="naukri">Naukri</SelectItem>
              <SelectItem value="career_site">Career site</SelectItem>
              <SelectItem value="referral">Referral</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Gender">
          <Select value={f.gender} onValueChange={(v) => u("gender", v)}>
            <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
              <SelectItem value="undisclosed">Prefer not to say</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Date of Birth">
          <Input type="date" value={f.dob} onChange={(e) => u("dob", e.target.value)} />
        </Field>

        <Field label="Current Salary">
          <div className="flex gap-1">
            <Select value={f.current_salary_currency} onValueChange={(v) => u("current_salary_currency", v)}>
              <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="INR">INR</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
            </Select>
            <Input type="number" disabled={f.current_salary_na} placeholder="Eg: 18,000"
              value={f.current_salary ?? ""} onChange={(e) => u("current_salary", e.target.value ? Number(e.target.value) : undefined)} />
            <label className="flex items-center gap-1 text-xs whitespace-nowrap"><input type="checkbox" checked={f.current_salary_na} onChange={(e) => u("current_salary_na", e.target.checked)} /> NA</label>
          </div>
        </Field>

        <Field label="Experience">
          <div className="flex gap-1">
            <Input type="number" min={0} placeholder="Ex: 3" value={f.experience_years ?? ""} onChange={(e) => u("experience_years", e.target.value ? Number(e.target.value) : undefined)} />
            <span className="self-center text-xs text-muted-foreground">Years</span>
            <Input type="number" min={0} max={11} placeholder="0" value={f.experience_months ?? ""} onChange={(e) => u("experience_months", e.target.value ? Number(e.target.value) : undefined)} />
            <span className="self-center text-xs text-muted-foreground">Months</span>
          </div>
        </Field>

        <Field label="Expected Salary">
          <div className="flex gap-1">
            <Select value={f.expected_salary_currency} onValueChange={(v) => u("expected_salary_currency", v)}>
              <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="INR">INR</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
            </Select>
            <Input type="number" disabled={f.expected_salary_na} placeholder="Eg: 20,000"
              value={f.expected_salary ?? ""} onChange={(e) => u("expected_salary", e.target.value ? Number(e.target.value) : undefined)} />
            <label className="flex items-center gap-1 text-xs whitespace-nowrap"><input type="checkbox" checked={f.expected_salary_na} onChange={(e) => u("expected_salary_na", e.target.checked)} /> NA</label>
          </div>
        </Field>

        <Field label="Available To Join (in days)">
          <Input type="number" placeholder="Ex: 60" value={f.available_to_join_days ?? ""} onChange={(e) => u("available_to_join_days", e.target.value ? Number(e.target.value) : undefined)} />
        </Field>

        <Field label="Preferred Location">
          <Input value={f.preferred_location} onChange={(e) => u("preferred_location", e.target.value)} placeholder="Select location" />
        </Field>
        <Field label="Current Location">
          <Input value={f.current_location} onChange={(e) => u("current_location", e.target.value)} placeholder="Select city" />
        </Field>
      </div>

      <div>
        <Label>Skills</Label>
        <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input px-2 py-1.5">
          {f.skills.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-xs">
              {s}
              <button onClick={() => rmSkill(s)} aria-label={`remove ${s}`}><X className="h-3 w-3" /></button>
            </span>
          ))}
          <input
            placeholder="Type and press enter"
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
            className="min-w-[160px] flex-1 bg-transparent px-1 text-sm focus:outline-none"
          />
        </div>
      </div>

      <div className="fixed bottom-0 right-0 w-full sm:w-[520px] sm:max-w-full border-t border-border bg-card px-6 py-3">
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onDone} disabled={pending}>Cancel</Button>
          <Button onClick={submit} disabled={pending}>{pending ? "Saving…" : "Add Candidate"}</Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}{required && <span className="text-rose-400"> *</span>}</Label>
      {children}
    </div>
  );
}
