"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Briefcase, Users, BarChart3, Settings, Bell, LogOut, ChevronUp, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials, cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/dashboard",  label: "Dashboard",  icon: LayoutDashboard },
  { href: "/jobs",       label: "Jobs",       icon: Briefcase },
  { href: "/candidates", label: "Candidates", icon: Users },
  { href: "/reports",    label: "Reports",    icon: BarChart3 },
  { href: "/settings",   label: "Settings",   icon: Settings }
];

interface Props {
  user: { first_name?: string | null; last_name?: string | null; email?: string | null };
  orgName: string;
  /** Mobile-only controls passed from layout */
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function AppSidebar({ user, orgName, mobileOpen, onMobileClose }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200",
          "lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        aria-label="Primary"
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-5">
          <Link href="/dashboard" className="flex items-center" aria-label={orgName}>
            <img src="/images/logo.png" alt={orgName} className="h-8 w-auto" />
          </Link>
          <button
            className="rounded-md p-1.5 text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground lg:hidden"
            onClick={onMobileClose}
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2">
          <ul className="space-y-1">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    prefetch
                    onClick={onMobileClose}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-white/10 text-white"
                        : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground"
                    )}
                  >
                    {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-primary" />}
                    <Icon className="h-[18px] w-[18px]" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Notifications row */}
        <div className="px-3 pb-2">
          <button className="flex w-full items-center gap-3 rounded-lg border border-sidebar-border bg-transparent px-3 py-2.5 text-sm font-medium text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground">
            <Bell className="h-[18px] w-[18px]" />
            <span className="flex-1 text-left">Notifications</span>
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          </button>
        </div>

        {/* User profile at bottom */}
        <div className="border-t border-sidebar-border p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-sidebar-hover">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback className="bg-primary text-[11px] font-semibold text-white">
                    {initials(user.first_name, user.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-white">
                    {user.first_name} {user.last_name}
                  </div>
                  <div className="truncate text-xs text-sidebar-muted">{user.email}</div>
                </div>
                <ChevronUp className="h-4 w-4 text-sidebar-muted" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-60 mb-1">
              <DropdownMenuItem onSelect={() => router.push("/settings")}>
                <Settings className="mr-2 h-4 w-4" /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => router.push("/settings/users")}>
                <Users className="mr-2 h-4 w-4" /> Users &amp; roles
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={signOut} className="text-rose-500 focus:text-rose-500">
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </>
  );
}
