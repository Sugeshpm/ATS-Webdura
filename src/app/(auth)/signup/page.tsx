import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { signupAction } from "./actions";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your organisation</CardTitle>
        <CardDescription>Start tracking hiring in minutes.</CardDescription>
      </CardHeader>
      <form action={signupAction}>
        <CardContent className="space-y-4">
          {params.error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{params.error}</div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="organisation">Organisation</Label>
            <Input id="organisation" name="organisation" required placeholder="Webdura Technologies" />
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
          <Button type="submit" className="w-full">Create organisation</Button>
          <p className="text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">Sign in</Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
