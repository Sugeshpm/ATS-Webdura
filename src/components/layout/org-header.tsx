"use client";
import { Search, Bell, ChevronDown } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Props {
  orgName: string;
  user: { first_name?: string | null; last_name?: string | null; email?: string | null; avatar_url?: string | null };
}

export function OrgHeader({ orgName, user }: Props) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="bg-brand-header text-white">
      <div className="flex h-12 items-center gap-3 px-3 sm:px-4">
        <a href="/dashboard" className="flex-shrink-0" aria-label={orgName}>
          <img src="/images/logo.png" alt={orgName} className="h-7 w-auto" />
        </a>

        <div className="ml-2 hidden max-w-2xl flex-1 items-center rounded-md bg-white/10 px-3 py-1.5 md:flex">
          <Search className="mr-2 h-4 w-4 opacity-70" />
          <input
            placeholder="Search candidates by name, phone number or email"
            className="flex-1 bg-transparent text-sm placeholder:text-white/60 focus:outline-none"
          />
          <button className="ml-2 flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 text-xs">
            Candidates <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        <button className="relative ml-auto rounded-full p-1.5 hover:bg-white/10" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-rose-400" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-full ring-2 ring-transparent hover:ring-white/30">
              <Avatar className="h-7 w-7">
                <AvatarFallback>{initials(user.first_name, user.last_name)}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="text-sm font-medium">{user.first_name} {user.last_name}</div>
              <div className="text-xs text-muted-foreground">{user.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => router.push("/settings")}>Settings</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => router.push("/settings/users")}>Users & roles</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={signOut} className="text-rose-400">Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
