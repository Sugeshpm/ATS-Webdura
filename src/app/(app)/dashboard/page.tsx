import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, UserPlus, CalendarClock, Trophy } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ count: activeJobs }, { count: totalCandidates }, { count: upcomingInterviews }, { count: hiredThisMonth }] = await Promise.all([
    supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("candidates").select("id", { count: "exact", head: true }).eq("category", "active"),
    supabase.from("interviews").select("id", { count: "exact", head: true }).gte("scheduled_start", new Date().toISOString()).eq("status", "scheduled"),
    supabase.from("applications").select("id", { count: "exact", head: true }).gte("updated_at", new Date(new Date().setDate(1)).toISOString())
  ]);

  const tiles = [
    { label: "Active jobs",        value: activeJobs ?? 0,         icon: Briefcase,    href: "/jobs" },
    { label: "Candidates",         value: totalCandidates ?? 0,    icon: UserPlus,     href: "/candidates" },
    { label: "Upcoming interviews",value: upcomingInterviews ?? 0, icon: CalendarClock,href: "/candidates" },
    { label: "Hired this month",   value: hiredThisMonth ?? 0,     icon: Trophy,       href: "/reports" }
  ];

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-semibold">Welcome back</h1>
      <p className="mt-1 text-sm text-muted-foreground">Here's a snapshot of your organisation's hiring activity.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(({ label, value, icon: Icon, href }) => (
          <a key={label} href={href}>
            <Card className="transition-colors hover:bg-secondary/40">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">{value}</div>
              </CardContent>
            </Card>
          </a>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
            <CardDescription>Stage changes and feedback from the last 24 hours.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">No activity yet.</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">My pending tasks</CardTitle>
            <CardDescription>Feedback to submit, candidates to review.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">You're all caught up.</CardContent>
        </Card>
      </div>
    </div>
  );
}
