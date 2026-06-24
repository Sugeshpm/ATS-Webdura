"use client";
import * as React from "react";
import { User, FileText, Folder, Activity, StickyNote, MessageSquare, MessagesSquare } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CandidateActionBar } from "@/components/candidates/candidate-detail/candidate-action-bar";
import { ResumePreviewButton } from "@/components/candidates/resume-preview";
import type { CandidateInitial } from "@/components/candidates/edit-candidate-drawer";

interface Resume {
  id: string;
  name: string;
  mime: string | null;
  storage_bucket: string;
  storage_path: string;
}

interface Props {
  candidate: CandidateInitial & { category: "active" | "talent_pool" | "archived" | "duplicate" };
  email: string | null;
  resume: Resume | null;
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

export function CandidateDetailShell({ candidate, email, resume, tabs }: Props) {
  const [tab, setTab] = React.useState<TabKey>("profile");
  const [focusNoteToken, setFocusNoteToken] = React.useState(0);
  const previewRef = React.useRef<HTMLButtonElement>(null);

  function handleAddNote() {
    setTab("notes");
    setFocusNoteToken((t) => t + 1);
  }

  function handlePreviewResume() {
    // Reuse the modal preview; clicking the action bar's button simulates a click on the hidden preview button below.
    previewRef.current?.click();
  }

  return (
    <>
      <CandidateActionBar
        candidate={candidate}
        email={email}
        resume={resume}
        onAddNote={handleAddNote}
        onPreviewResume={handlePreviewResume}
      />

      {/* Hidden mount so the modal-based ResumePreview still works for the action bar. */}
      <div className="sr-only">
        <ResumePreviewButton document={resume} />
      </div>

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
          {/* Re-render with focus token so the composer focuses each time the action bar is clicked */}
          {React.isValidElement(tabs.notes)
            ? React.cloneElement(tabs.notes as React.ReactElement<{ autoFocus?: boolean; focusToken?: number }>, { autoFocus: focusNoteToken > 0, focusToken: focusNoteToken })
            : tabs.notes}
        </TabsContent>
        <TabsContent value="feedback">{tabs.feedback}</TabsContent>
        <TabsContent value="communication">{tabs.communication}</TabsContent>
      </Tabs>
    </>
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
