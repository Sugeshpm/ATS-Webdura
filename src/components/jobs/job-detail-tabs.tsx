import Link from "next/link";
import { LayoutDashboard, Users, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "dashboard",   label: "Dashboard",        icon: LayoutDashboard },
  { id: "candidates",  label: "Candidates",       icon: Users },
  { id: "description", label: "Job Description",  icon: FileText }
] as const;

export type JobDetailTab = typeof TABS[number]["id"];

export function JobDetailTabs({ jobId, active }: { jobId: string; active: JobDetailTab }) {
  return (
    <nav className="-mx-1 overflow-x-auto border-b border-border">
      <ul className="flex min-w-max items-center gap-1 px-1">
        {TABS.map((tab) => {
          const isActive = tab.id === active;
          const Icon = tab.icon;
          return (
            <li key={tab.id}>
              <Link
                href={tab.id === "dashboard" ? `/jobs/${jobId}` : `/jobs/${jobId}?tab=${tab.id}`}
                className={cn(
                  "relative inline-flex items-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-sm transition-colors",
                  isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
                {isActive && <span className="absolute inset-x-2 -bottom-px h-0.5 bg-primary" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
