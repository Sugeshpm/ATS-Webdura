"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDate, initials } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";

type Note = {
  id: string;
  body: string;
  created_at: string;
  author: { first_name: string | null; last_name: string | null } | null;
};

export function NotesRail({ applicationId, notes }: { applicationId: string; notes: Note[] }) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [pending, setPending] = React.useState(false);

  async function submit() {
    if (!body.trim()) return;
    setPending(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user!.id).single();
    const { error } = await supabase.from("notes").insert({
      tenant_id: profile!.tenant_id,
      application_id: applicationId,
      author_id: user!.id,
      body
    });
    setPending(false);
    if (error) return toast.error(error.message);
    setBody("");
    router.refresh();
  }

  return (
    <div className="w-80 shrink-0 border-l border-border p-4">
      <Textarea placeholder="Share your thoughts and notes here..." rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
      <div className="mt-2 flex justify-end">
        <Button size="sm" onClick={submit} disabled={pending || !body.trim()}>Post</Button>
      </div>

      <ul className="mt-5 space-y-4">
        {notes.map((n) => (
          <li key={n.id} className="text-sm">
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-[9px]">{initials(n.author?.first_name, n.author?.last_name)}</AvatarFallback>
              </Avatar>
              <div className="text-xs">
                <span className="font-medium">{n.author?.first_name} {n.author?.last_name}</span>
                <span className="ml-2 text-muted-foreground">{formatDate(n.created_at)}</span>
              </div>
            </div>
            <div className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{n.body}</div>
          </li>
        ))}
        {notes.length === 0 && <li className="text-xs text-muted-foreground">No notes yet.</li>}
      </ul>
    </div>
  );
}
