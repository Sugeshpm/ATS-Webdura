import Link from "next/link";

const TABS = [
  { href: "/candidates",                  label: "My Candidates" },
  { href: "/candidates?view=all",         label: "All Candidates" },
  { href: "/candidates?view=talent_pool", label: "Talent Pool" },
  { href: "/candidates?view=archived",    label: "Archived" },
  { href: "/candidates?view=duplicates",  label: "Duplicates" }
];

export default function CandidatesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="border-b border-border bg-brand-header/95 text-white/80">
        <ul className="container flex items-center gap-6 text-xs font-semibold uppercase tracking-wide">
          {TABS.map((t) => (
            <li key={t.href}>
              <Link href={t.href} className="block py-2.5 hover:text-white">{t.label}</Link>
            </li>
          ))}
        </ul>
      </div>
      {children}
    </div>
  );
}
