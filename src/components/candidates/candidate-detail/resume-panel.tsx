"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, ExternalLink, FileText, Upload, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";

interface Document {
  id: string;
  name: string;
  mime: string | null;
  size_bytes: number | null;
  storage_bucket: string;
  storage_path: string;
  created_at: string;
}

interface Props {
  candidateId: string;
  tenantId: string;
  resume: Document | null;
}

export function ResumePanel({ candidateId, tenantId, resume }: Props) {
  const router = useRouter();
  const [url, setUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

  const isPdf = React.useMemo(() => {
    if (!resume) return false;
    return (resume.mime ?? "").includes("pdf") || resume.name.toLowerCase().endsWith(".pdf");
  }, [resume]);
  const isDoc = React.useMemo(() => {
    if (!resume) return false;
    const m = (resume.mime ?? "").toLowerCase();
    const n = resume.name.toLowerCase();
    return m.includes("msword") || m.includes("officedocument") || n.endsWith(".doc") || n.endsWith(".docx");
  }, [resume]);

  React.useEffect(() => {
    if (!resume) { setUrl(null); return; }
    let cancelled = false;
    setLoading(true);
    const supabase = createClient();
    supabase.storage
      .from(resume.storage_bucket)
      .createSignedUrl(resume.storage_path, 60 * 30)
      .then(({ data, error }) => {
        if (cancelled) return;
        setLoading(false);
        if (error || !data) { toast.error(error?.message ?? "Couldn't load resume."); return; }
        setUrl(data.signedUrl);
      });
    return () => { cancelled = true; };
  }, [resume]);

  async function upload(file: File) {
    if (file.size > 10 * 1024 * 1024) return toast.error("Resume must be ≤ 10 MB.");
    setUploading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return toast.error("Not signed in."); }
    const path = `${tenantId}/${candidateId}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("resumes").upload(path, file);
    if (upErr) { setUploading(false); return toast.error(upErr.message); }
    const { error: dErr } = await supabase.from("documents").insert({
      tenant_id: tenantId, candidate_id: candidateId, kind: "resume", name: file.name,
      mime: file.type, size_bytes: file.size, storage_bucket: "resumes", storage_path: path, uploaded_by: user.id
    });
    setUploading(false);
    if (dErr) return toast.error(dErr.message);
    toast.success("Resume uploaded.");
    router.refresh();
  }

  if (!resume) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <FileText className="h-5 w-5" />
        </span>
        <h3 className="text-sm font-semibold">No resume on file</h3>
        <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
          Upload a PDF, DOC, or DOCX so the team can review the candidate&apos;s background.
        </p>
        <label className="mt-4 inline-flex">
          <input
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="sr-only"
            disabled={uploading}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
          />
          <span className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Upload className="h-4 w-4" />{uploading ? "Uploading…" : "Upload resume"}
          </span>
        </label>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <FileText className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{resume.name}</div>
            <div className="text-[11px] text-muted-foreground">
              Uploaded {formatDate(resume.created_at)}{resume.size_bytes ? ` · ${Math.round(resume.size_bytes / 1024)} KB` : ""}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {url && (
            <>
              <Button asChild variant="outline" size="sm">
                <a href={url} target="_blank" rel="noopener noreferrer"><Maximize2 className="mr-1 h-4 w-4" /> Full screen</a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-1 h-4 w-4" /> Open</a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={url} download={resume.name}><Download className="mr-1 h-4 w-4" /> Download</a>
              </Button>
            </>
          )}
        </div>
      </header>

      <div className="aspect-[4/5] w-full overflow-hidden bg-black/40">
        {loading && <Centered>Loading preview…</Centered>}
        {!loading && url && isPdf && (
          <iframe src={`${url}#view=FitH`} title={resume.name} className="h-full w-full" />
        )}
        {!loading && url && isDoc && (
          <iframe
            src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`}
            title={resume.name}
            className="h-full w-full bg-white"
          />
        )}
        {!loading && url && !isPdf && !isDoc && (
          <Centered>
            <div className="text-center text-xs text-muted-foreground">
              Preview not supported for this file type. Use Download to view it.
            </div>
          </Centered>
        )}
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{children}</div>;
}
