"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { updateCandidate } from "@/app/(app)/candidates/actions";

export interface CandidateInitial {
  id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  gender: string | null;
  date_of_birth: string | null;
  current_company: string | null;
  current_location: string | null;
  preferred_location: string | null;
  experience_years: number | null;
  experience_months: number | null;
  notice_period_days: number | null;
  current_salary: number | null;
  current_salary_currency: string | null;
  expected_salary: number | null;
  expected_salary_currency: string | null;
  source: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
}

export function EditCandidateDrawer({ initial }: { initial: CandidateInitial }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState(initial);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => { if (open) setF(initial); }, [open, initial]);

  function u<K extends keyof CandidateInitial>(k: K, v: CandidateInitial[K]) {
    setF((p) => ({ ...p, [k]: v }));
  }

  async function save() {
    if (!f.first_name.trim()) return toast.error("First name is required.");
    setPending(true);
    const { id, ...patch } = f;
    const result = await updateCandidate(id, {
      ...patch,
      first_name: f.first_name.trim(),
      middle_name: f.middle_name?.trim() || null,
      last_name: f.last_name?.trim() || null,
      email: f.email?.trim() || null,
      phone: f.phone?.trim() || null
    });
    setPending(false);
    if (!result.ok) return toast.error(result.error ?? "Update failed.");
    toast.success("Candidate updated.");
    setOpen(false);
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm"><Pencil className="mr-1 h-4 w-4" /> Edit</Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:w-[520px] sm:max-w-full">
        <SheetHeader><SheetTitle>Edit candidate</SheetTitle></SheetHeader>

        <div className="mt-4 grid grid-cols-2 gap-3 pb-24">
          <Field label="First Name" required>
            <Input value={f.first_name} onChange={(e) => u("first_name", e.target.value)} />
          </Field>
          <Field label="Middle Name">
            <Input value={f.middle_name ?? ""} onChange={(e) => u("middle_name", e.target.value)} />
          </Field>
          <Field label="Last Name">
            <Input value={f.last_name ?? ""} onChange={(e) => u("last_name", e.target.value)} />
          </Field>
          <Field label="Mobile">
            <Input value={f.phone ?? ""} onChange={(e) => u("phone", e.target.value)} placeholder="+91 …" />
          </Field>
          <Field label="Email">
            <Input type="email" value={f.email ?? ""} onChange={(e) => u("email", e.target.value)} />
          </Field>
          <Field label="Gender">
            <Select value={f.gender ?? ""} onValueChange={(v) => u("gender", v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
                <SelectItem value="undisclosed">Prefer not to say</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Date of Birth">
            <Input type="date" value={f.date_of_birth ?? ""} onChange={(e) => u("date_of_birth", e.target.value || null)} />
          </Field>
          <Field label="Source">
            <Input value={f.source ?? ""} onChange={(e) => u("source", e.target.value)} placeholder="linkedin / referral / …" />
          </Field>

          <Field label="Experience (years)">
            <Input type="number" min={0} value={f.experience_years ?? ""} onChange={(e) => u("experience_years", e.target.value ? Number(e.target.value) : null)} />
          </Field>
          <Field label="Experience (months)">
            <Input type="number" min={0} max={11} value={f.experience_months ?? ""} onChange={(e) => u("experience_months", e.target.value ? Number(e.target.value) : null)} />
          </Field>
          <Field label="Current Company">
            <Input value={f.current_company ?? ""} onChange={(e) => u("current_company", e.target.value)} />
          </Field>
          <Field label="Notice period (days)">
            <Input type="number" value={f.notice_period_days ?? ""} onChange={(e) => u("notice_period_days", e.target.value ? Number(e.target.value) : null)} />
          </Field>

          <Field label="Current Salary">
            <div className="flex gap-1">
              <Select value={f.current_salary_currency ?? "INR"} onValueChange={(v) => u("current_salary_currency", v)}>
                <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="INR">INR</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
              </Select>
              <Input type="number" value={f.current_salary ?? ""} onChange={(e) => u("current_salary", e.target.value ? Number(e.target.value) : null)} />
            </div>
          </Field>
          <Field label="Expected Salary">
            <div className="flex gap-1">
              <Select value={f.expected_salary_currency ?? "INR"} onValueChange={(v) => u("expected_salary_currency", v)}>
                <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="INR">INR</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
              </Select>
              <Input type="number" value={f.expected_salary ?? ""} onChange={(e) => u("expected_salary", e.target.value ? Number(e.target.value) : null)} />
            </div>
          </Field>

          <Field label="Current Location">
            <Input value={f.current_location ?? ""} onChange={(e) => u("current_location", e.target.value)} />
          </Field>
          <Field label="Preferred Location">
            <Input value={f.preferred_location ?? ""} onChange={(e) => u("preferred_location", e.target.value)} />
          </Field>

          <Field label="LinkedIn URL" full>
            <Input value={f.linkedin_url ?? ""} onChange={(e) => u("linkedin_url", e.target.value)} placeholder="https://linkedin.com/in/…" />
          </Field>
          <Field label="GitHub URL" full>
            <Input value={f.github_url ?? ""} onChange={(e) => u("github_url", e.target.value)} />
          </Field>
          <Field label="Portfolio URL" full>
            <Input value={f.portfolio_url ?? ""} onChange={(e) => u("portfolio_url", e.target.value)} />
          </Field>
        </div>

        <div className="fixed bottom-0 right-0 w-full sm:w-[520px] sm:max-w-full border-t border-border bg-card px-6 py-3">
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={save} disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, required, full, children }: { label: string; required?: boolean; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={"space-y-1" + (full ? " col-span-2" : "")}>
      <Label>{label}{required && <span className="text-rose-400"> *</span>}</Label>
      {children}
    </div>
  );
}
