"use client";
import * as React from "react";
import { User, FileText, Folder, Activity, StickyNote, MessageSquare, MessagesSquare } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CandidateHeader } from "@/components/candidates/candidate-detail/candidate-header";
import type { CandidateInitial } from "@/components/candidates/edit-candidate-drawer";
import type { CandidateCategory } from "@/app/(app)/candidates/actions";

interface HeaderData {
  applicationId: string;
  display: {
    first_name: string;
    last_name: string | null;
    current_company: string | null;
    current_location: string | null;
    email: string | null;
    phone: string | null;
    experience_years: number | null;
    experience_months: number | null;
    source: string | null;
    linkedin_url: string | null;
    github_url: string | null;
    portfolio_url: string | null;
    updated_at: string;
  };
  job: { id: string; title: string } | null;
  stage: { id: string; name: string; color: string | null } | null;
  owner: { first_name: string | null; last_name: string | null } | null;
  appliedAt: string;
  currentStageId: string | null;
  stages: { id: string; name: string }[];
}

interface Props {
  candidate: CandidateInitial & { category: CandidateCategory };
  email: string | null;
  header: HeaderData;
  summary: React.ReactNode;
  tabs: {
    profile: React.ReactNode;
    resume: React.ReactNode;
    documents: React.ReactNode;
    activity: React.ReactNode;
    notes: React.ReactNode;
    feedback: React.ReactNode;
    communication: React.ReactNode;
  };
}

type TabKey = "profile" | "resume" | "documents" | "activity" | "notes" | "feedback" | "communication";

export function CandidateDetailShell({ candidate, email, header, summary, tabs }: Props) {
  const [tab, setTab] = React.useState<TabKey>("profile");
  const [focusNoteToken, setFocusNoteToken] = React.useState(0);

  function handleAddNote() {
    setTab("notes");
    setFocusNoteToken((t) => t + 1);
  }

  return (
    <div className="space-y-4">
      <CandidateHeader
        applicationId={header.applicationId}
        display={header.display}
        candidate={candidate}
        email={email}
        job={header.job}
        stage={header.stage}
        owner={header.owner}
        appliedAt={header.appliedAt}
        currentStageId={header.currentStageId}
        stages={header.stages}
        onAddNote={handleAddNote}
      />

      {summary}

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="flex w-full flex-wrap gap-2 overflow-x-auto sm:gap-4">
          <TabTrigger value="profile" icon={User}>Profile</TabTrigger>
          <TabTrigger value="resume" icon={FileText}>Resume</TabTrigger>
          <TabTrigger value="documents" icon={Folder}>Documents</TabTrigger>
          <TabTrigger value="activity" icon={Activity}>Activity</TabTrigger>
          <TabTrigger value="notes" icon={StickyNote}>Notes</TabTrigger>
          <TabTrigger value="feedback" icon={MessageSquare}>Feedback</TabTrigger>
          <TabTrigger value="communication" icon={MessagesSquare}>Communication</TabTrigger>
        </TabsList>

        <TabsContent value="profile">{tabs.profile}</TabsContent>
        <TabsContent value="resume">{tabs.resume}</TabsContent>
        <TabsContent value="documents">{tabs.documents}</TabsContent>
        <TabsContent value="activity">{tabs.activity}</TabsContent>
        <TabsContent value="notes">
          {React.isValidElement(tabs.notes)
            ? React.cloneElement(tabs.notes as React.ReactElement<{ autoFocus?: boolean; focusToken?: number }>, { autoFocus: focusNoteToken > 0, focusToken: focusNoteToken })
            : tabs.notes}
        </TabsContent>
        <TabsContent value="feedback">{tabs.feedback}</TabsContent>
        <TabsContent value="communication">{tabs.communication}</TabsContent>
      </Tabs>
    </div>
  );
}

function TabTrigger({ value, icon: Icon, children }: { value: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <TabsTrigger value={value} className="flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5" />
      <span>{children}</span>
    </TabsTrigger>
  );
}
