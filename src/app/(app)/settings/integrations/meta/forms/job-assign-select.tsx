"use client";
import { updateMetaFormJob } from "../actions";

/**
 * Job assignment dropdown for a registered form. Client component because it
 * auto-submits on change — event handlers can't live in a Server Component.
 */
export function JobAssignSelect({
  formRowId,
  currentJobId,
  jobs
}: {
  formRowId: string;
  currentJobId: string | null;
  jobs: { id: string; title: string }[];
}) {
  return (
    <form action={updateMetaFormJob} className="inline-flex">
      <input type="hidden" name="id" value={formRowId} />
      <select
        name="job_id"
        defaultValue={currentJobId ?? ""}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="h-8 max-w-[200px] rounded-md border border-input bg-white px-2 text-xs"
      >
        <option value="">— No job (unassigned)</option>
        {jobs.map((j) => (
          <option key={j.id} value={j.id}>{j.title}</option>
        ))}
      </select>
    </form>
  );
}
