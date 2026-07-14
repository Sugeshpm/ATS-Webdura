export default function CandidatesLayout({ children }: { children: React.ReactNode }) {
  // Sub-tabs used to live here, but they need per-tab counts that depend on
  // searchParams (job status filter). Layouts don't receive searchParams in
  // the App Router, so the tabs are now rendered from within the page.
  return <>{children}</>;
}
