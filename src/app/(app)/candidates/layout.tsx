import { CandidatesSubTabs } from "@/components/candidates/sub-tabs";

export default function CandidatesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <CandidatesSubTabs />
      {children}
    </div>
  );
}
