"use client";
import * as React from "react";
import { AppSidebar } from "./app-sidebar";
import { AppHeader } from "./app-header";

interface Props {
  user: { first_name?: string | null; last_name?: string | null; email?: string | null };
  orgName: string;
  children: React.ReactNode;
}

export function AppShell({ user, orgName, children }: Props) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen">
      <AppSidebar
        user={user}
        orgName={orgName}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader user={user} onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
