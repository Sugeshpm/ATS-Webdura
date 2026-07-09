"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Switch } from "@/components/ui/switch";

export function JobPriorityToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const on = params.get("priority") === "1";

  function toggle(checked: boolean) {
    const next = new URLSearchParams(params.toString());
    if (checked) next.set("priority", "1"); else next.delete("priority");
    router.push(`${pathname}${next.toString() ? `?${next}` : ""}`);
  }

  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <Switch checked={on} onCheckedChange={toggle} aria-label="Show only priority" />
      Show only priority
    </label>
  );
}
