import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

async function action(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return redirect(`/forgot-password?error=${encodeURIComponent("Email is required.")}`);
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/reset-password`
  });
  if (error) return redirect(`/forgot-password?error=${encodeURIComponent(error.message)}`);
  redirect("/forgot-password?sent=1");
}

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string; sent?: string }> }) {
  const params = await searchParams;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Forgot password</CardTitle>
        <CardDescription>We&apos;ll send you a reset link.</CardDescription>
      </CardHeader>
      <form action={action}>
        <CardContent className="space-y-4">
          {params.sent && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2 text-xs text-emerald-300">
              If that email exists, a reset link is on its way.
            </div>
          )}
          {params.error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{params.error}</div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full">Send reset link</Button>
          <Link href="/login" className="text-xs text-muted-foreground hover:underline">Back to sign in</Link>
        </CardFooter>
      </form>
    </Card>
  );
}
