import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

async function action(formData: FormData) {
  "use server";
  const password = String(formData.get("password") ?? "");
  if (!password || password.length < 8) {
    return redirect(`/reset-password?error=${encodeURIComponent("Password must be at least 8 characters.")}`);
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  redirect("/dashboard");
}

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Set a new password</CardTitle>
        <CardDescription>Choose a strong password you don&apos;t use elsewhere.</CardDescription>
      </CardHeader>
      <form action={action}>
        <CardContent className="space-y-4">
          {params.error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{params.error}</div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="password">New password</Label>
            <Input id="password" name="password" type="password" minLength={8} required />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full">Update password</Button>
        </CardFooter>
      </form>
    </Card>
  );
}
