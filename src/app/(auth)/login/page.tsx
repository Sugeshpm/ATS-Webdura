import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { loginAction } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Welcome back. Enter your credentials to continue.</CardDescription>
      </CardHeader>
      <form action={loginAction}>
        <CardContent className="space-y-4">
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
            <Link href="/signup" className="text-primary hover:underline">Create an organisation</Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
