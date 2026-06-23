"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard",  label: "Home" },
  { href: "/jobs",       label: "Jobs" },
  { href: "/candidates", label: "Candidates" },
  { href: "/reports",    label: "Reports" },
  { href: "/settings",   label: "Settings" }
];

export function TopNav() {
  const pathname = usePathname();
  return (
    <nav className="bg-brand-header/95 text-white">
      <ul className="flex h-10 items-center gap-6 px-6 text-xs font-semibold uppercase tracking-wide">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "relative flex h-10 items-center transition-colors hover:text-white",
                  active ? "text-white" : "text-white/70"
                )}
              >
                {item.label}
                {active && <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-white" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
