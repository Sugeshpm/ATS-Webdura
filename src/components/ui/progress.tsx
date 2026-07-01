import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0..100 — pass null for indeterminate stripe animation. */
  value: number | null;
}

export function Progress({ value, className, ...rest }: ProgressProps) {
  const clamped = value == null ? null : Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped ?? undefined}
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-secondary", className)}
      {...rest}
    >
      {clamped == null ? (
        <div className="absolute inset-y-0 w-1/3 animate-[progress-slide_1.2s_ease-in-out_infinite] rounded-full bg-primary/80" />
      ) : (
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${clamped}%` }}
        />
      )}
      <style>{`@keyframes progress-slide { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }`}</style>
    </div>
  );
}
