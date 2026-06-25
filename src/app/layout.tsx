import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "Hiring Tracker",
  description: "Recruit, evaluate, and onboard candidates."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
