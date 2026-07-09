"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

export function SyncNowButton({ formId }: { formId: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function sync() {
    setPending(true);
    const res = await fetch("/api/integrations/meta/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ form_id: formId })
    });

    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => ({}));
      setPending(false);
      toast.error(data.error ?? `Sync failed (${res.status}).`);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let totals = { inserted: 0, duplicate: 0, failed: 0 };
    let errMsg: string | null = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        try {
          const evt = JSON.parse(line);
          if (evt.type === "done") totals = { inserted: evt.inserted, duplicate: evt.duplicate, failed: evt.failed };
          if (evt.type === "error") errMsg = String(evt.error);
        } catch { /* ignore */ }
      }
    }

    setPending(false);
    if (errMsg) toast.error(`Sync error: ${errMsg}`);
    else toast.success(`Synced · Inserted ${totals.inserted} · Duplicate ${totals.duplicate} · Failed ${totals.failed}`);
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={sync} disabled={pending} className="text-xs" title="Fetch recent leads from Meta">
      <RefreshCw className={"h-3.5 w-3.5 " + (pending ? "animate-spin" : "")} />
    </Button>
  );
}
