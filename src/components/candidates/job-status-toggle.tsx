"use client";
import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Briefcase, Archive } from "lucide-react";
import { cn } from "@/lib/utils";

export type JobStatusFilter = "active" | "closed";

/**
 * Segmented toggle for Active vs Closed job status.
 *
 * Writes `?status=<value>` into the URL. All other search params (view, job,
 * stage, source, q, page) are preserved. Uses router.replace so the browser
 * history isn't polluted by every toggle.
 */
export function JobStatusToggle({ value }: { value: JobStatusFilter }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [pending, startTransition] = React.useTransition();

  function selectStatus(next: JobStatusFilter) {
    if (next === value) return;
    const params = new URLSearchParams(search.toString());
    params.set("status", next);
    // Reset the job filter — a job selected under one status has no meaning under the other.
    params.delete("job");
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  const options: Array<{ id: JobStatusFilter; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
    { id: "active", label: "Active jobs", Icon: Briefcase },
    { id: "closed", label: "Closed jobs", Icon: Archive }
  ];

  return (
    <div
      role="tablist"
      aria-label="Job status"
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-white p-0.5 shadow-sm transition-opacity",
        pending && "opacity-70"
      )}
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            role="tab"
            aria-selected={active}
            onClick={() => selectStatus(opt.id)}
            disabled={pending}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <opt.Icon className="h-3.5 w-3.5" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
