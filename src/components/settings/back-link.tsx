import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function BackToSettings() {
  return (
    <Link href="/settings" className="mb-3 inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
      <ChevronLeft className="h-4 w-4" /> Settings
    </Link>
  );
}
