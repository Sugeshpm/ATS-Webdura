import Link from "next/link";
import { Clock, ShieldAlert, Ban, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { loginAction } from "./actions";

const STATUS_BANNERS: Record<string, { tone: "info" | "warn" | "block"; icon: React.ComponentType<{ className?: string }>; title: string; body: string }> = {
  pending: {
    tone: "info",
    icon: Clock,
    title: "Awaiting administrator approval",
    body: "Your account has been created. An administrator must approve it before you can sign in."
  },
  rejected: {
    tone: "block",
    icon: Ban,
    title: "Sign-in declined",
    body: "An administrator declined this account. Reach out to your admin for next steps."
  },
  disabled: {
    tone: "warn",
    icon: ShieldAlert,
    title: "Account disabled",
    body: "Your account has been disabled. Contact your administrator to be reinstated."
  }
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; status?: string; signup?: string }> }) {
  const params = await searchParams;
  const banner = params.status ? STATUS_BANNERS[params.status] : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Welcome back. Enter your credentials to continue.</CardDescription>
      </CardHeader>
      <form action={loginAction}>
        <CardContent className="space-y-4">
          {params.signup === "pending" && (
            <Banner tone="info" icon={MailCheck} title="Account created">
              Your registration is pending administrator approval. You&apos;ll be notified once it&apos;s reviewed.
            </Banner>
          )}
          {banner && (
            <Banner tone={banner.tone} icon={banner.icon} title={banner.title}>
              {banner.body}
            </Banner>
          )}
          {params.error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{params.error}</div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="text-xs text-primary hover:underline">Forgot?</Link>
            </div>
            <Input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full">Sign in</Button>
          <p className="text-xs text-muted-foreground">
            New here?{" "}
            <Link href="/signup" className="text-primary hover:underline">Sign up for an account</Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

function Banner({ tone, icon: Icon, title, children }: { tone: "info" | "warn" | "block"; icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  const palette = {
    info:  "border-sky-500/30 bg-sky-500/10 text-sky-200",
    warn:  "border-amber-500/30 bg-amber-500/10 text-amber-200",
    block: "border-rose-500/30 bg-rose-500/10 text-rose-200"
  }[tone];
  return (
    <div className={`flex items-start gap-2 rounded-md border p-3 text-xs ${palette}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <div className="font-semibold">{title}</div>
        <p className="mt-0.5 opacity-90">{children}</p>
      </div>
    </div>
  );
}
