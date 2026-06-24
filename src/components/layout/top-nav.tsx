"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
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
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <nav className="bg-brand-header/95 text-white">
      {/* Tablet & desktop */}
      <ul className="hidden h-10 items-center gap-6 px-6 text-xs font-semibold uppercase tracking-wide md:flex">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                prefetch
                className={cn("relative flex h-10 items-center transition-colors hover:text-white",
                  active ? "text-white" : "text-white/70")}
              >
                {item.label}
                {active && <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-white" />}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Mobile toggle bar */}
      <div className="flex h-10 items-center justify-between px-4 text-xs font-semibold uppercase tracking-wide md:hidden">
        <span className="text-white/80">Menu</span>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="rounded-md p-1.5 hover:bg-white/10"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {open && (
        <ul className="border-t border-white/10 px-2 pb-2 md:hidden">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  prefetch
                  className={cn("block rounded-md px-3 py-2 text-sm",
                    active ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/5")}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
