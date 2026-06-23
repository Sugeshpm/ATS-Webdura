import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors",
  {
    variants: {
      variant: {
        default: "border-border bg-secondary text-secondary-foreground",
        confidential: "border-amber-500/30 bg-amber-500/10 text-amber-300",
        online: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
        offline: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
        priority: "border-rose-500/30 bg-rose-500/10 text-rose-300",
        outline: "border-border bg-transparent text-foreground"
      }
    },
    defaultVariants: { variant: "default" }
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
