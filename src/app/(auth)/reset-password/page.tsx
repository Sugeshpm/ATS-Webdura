import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

async function action(formData: FormData) {
  "use server";
  const password = String(formData.get("password") ?? "");
  const invited = String(formData.get("invited") ?? "") === "1";
  if (!password || password.length < 8) {
    return redirect(`/reset-password?${invited ? "invited=1&" : ""}error=${encodeURIComponent("Password must be at least 8 characters.")}`);
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return redirect(`/reset-password?${invited ? "invited=1&" : ""}error=${encodeURIComponent(error.message)}`);

  // If this completion is part of an invitation flow, promote the profile from invited → active.
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase
      .from("profiles")
      .update({ status: "active", last_login_at: new Date().toISOString() } as never)
      .eq("id", user.id)
      .eq("status", "invited"); // only update if still invited
  }
  redirect("/dashboard");
}

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string; invited?: string }> }) {
  const params = await searchParams;
  const isInvite = params.invited === "1";
  return (
    <Card>
      <CardHeader>
        <CardTitle>{isInvite ? "Welcome — set your password" : "Set a new password"}</CardTitle>
        <CardDescription>
          {isInvite
            ? "Choose a password to finish setting up your account. You'll use it to sign in from now on."
            : "Choose a strong password you don't use elsewhere."}
        </CardDescription>
      </CardHeader>
      <form action={action}>
        <CardContent className="space-y-4">
          {params.error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{params.error}</div>
          )}
          {isInvite && <input type="hidden" name="invited" value="1" />}
          <div className="space-y-1.5">
            <Label htmlFor="password">{isInvite ? "Create password" : "New password"}</Label>
            <Input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" />
            <p className="text-[11px] text-muted-foreground">At least 8 characters.</p>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full">{isInvite ? "Continue to dashboard" : "Update password"}</Button>
        </CardFooter>
      </form>
    </Card>
  );
}
