import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors",
  {
    variants: {
      variant: {
        default:      "border-border bg-secondary text-secondary-foreground",
        outline:      "border-border bg-transparent text-foreground",
        confidential: "border-amber-300 bg-amber-50 text-amber-700",
        online:       "border-emerald-300 bg-emerald-50 text-emerald-700",
        offline:      "border-slate-300 bg-slate-100 text-slate-600",
        priority:     "border-rose-300 bg-rose-50 text-rose-700",
        info:         "border-sky-300 bg-sky-50 text-sky-700",
        warning:      "border-amber-300 bg-amber-50 text-amber-700",
        success:      "border-emerald-300 bg-emerald-50 text-emerald-700",
        danger:       "border-rose-300 bg-rose-50 text-rose-700",
        purple:       "border-violet-300 bg-violet-50 text-violet-700",
        muted:        "border-slate-300 bg-slate-100 text-slate-600"
      }
    },
    defaultVariants: { variant: "default" }
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/** Map a stage code/name to a tinted variant for consistent stage colouring. */
export function stageBadgeVariant(stage: string | null | undefined): VariantProps<typeof badgeVariants>["variant"] {
  if (!stage) return "default";
  const c = stage.toLowerCase().replace(/[\s-]+/g, "_");
  if (c === "sourced")          return "muted";
  if (c === "screening")        return "info";
  if (c === "no_response")      return "warning";
  if (c.includes("interview"))  return "purple";
  if (c.includes("tech"))       return "purple";
  if (c.includes("face"))       return "purple";
  if (c.includes("hr"))         return "info";
  if (c.includes("shortlist"))  return "success";
  if (c.includes("preboard"))   return "success";
  if (c === "hired")            return "success";
  if (c === "rejected")         return "danger";
  return "default";
}
