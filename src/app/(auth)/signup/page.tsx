import Link from "next/link";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { signupAction } from "./actions";
import { GoogleSignInButton } from "../google-button";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>An administrator will approve your request before you can sign in.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pb-0">
        <GoogleSignInButton label="Sign up with Google" />
        <p className="text-[11px] text-muted-foreground">
          Only <span className="font-medium">@webduratech.com</span> and <span className="font-medium">@webdura.in</span> addresses can register.
          Contractors on other domains need an admin to add them to the allowlist first.
        </p>
        <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          <span>or use email &amp; password</span>
          <div className="h-px flex-1 bg-border" />
        </div>
      </CardContent>
      <form action={signupAction}>
        <CardContent className="space-y-4">
          {params.error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{params.error}</div>
          )}

          <div className="flex items-start gap-2 rounded-md border border-sky-500/30 bg-sky-500/10 p-3 text-xs text-sky-200">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>You&apos;ll be able to sign in once an administrator reviews and approves your account.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="first_name">First name</Label>
              <Input id="first_name" name="first_name" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="last_name">Last name</Label>
              <Input id="last_name" name="last_name" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Work email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" />
            <p className="text-[11px] text-muted-foreground">At least 8 characters.</p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full">Request account</Button>
          <p className="text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">Sign in</Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
