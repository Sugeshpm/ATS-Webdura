import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(first?: string | null, last?: string | null) {
  const f = (first || "").trim().charAt(0).toUpperCase();
  const l = (last || "").trim().charAt(0).toUpperCase();
  return (f + l) || "?";
}

export function formatDate(d: string | Date, opts?: Intl.DateTimeFormatOptions) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-IN", opts || { day: "2-digit", month: "short", year: "numeric" });
}
