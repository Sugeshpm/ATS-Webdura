"use client";
import * as React from "react";
import { Menu, Search, Bell } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/utils";

interface Props {
  user: { first_name?: string | null; last_name?: string | null };
  onMenuClick: () => void;
}

export function AppHeader({ user, onMenuClick }: Props) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-white/95 px-4 backdrop-blur lg:px-6">
      {/* Mobile hamburger */}
      <button
        className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground lg:hidden"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Search */}
      <label className="relative flex h-10 flex-1 max-w-xl items-center rounded-lg border border-input bg-surface-sunken px-3 transition-colors focus-within:border-ring focus-within:bg-white focus-within:ring-1 focus-within:ring-ring">
        <Search className="mr-2 h-4 w-4 text-muted-foreground" />
        <input
          placeholder="Search candidates, jobs, emails, or phone numbers..."
          className="h-10 w-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
        />
        <kbd className="ml-2 hidden rounded border border-border bg-white px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground md:inline">⌘ K</kbd>
      </label>

      <div className="ml-auto flex items-center gap-1.5">
        <button className="relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
        </button>
        <div className="ml-1 lg:hidden">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-[11px] font-semibold text-white">
              {initials(user.first_name, user.last_name)}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
