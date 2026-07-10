"use client";
import * as React from "react";
import { Eye, Download, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { resolveResumeUrl } from "@/lib/resume-url";

interface Props {
  document: {
    id: string;
    name: string;
    mime: string | null;
    storage_bucket: string;
    storage_path: string;
  } | null;
}

export function ResumePreviewButton({ document }: Props) {
  const [open, setOpen] = React.useState(false);
  const [url, setUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function loadSignedUrl() {
    if (!document) return;
    setLoading(true);
    const { url: resolved, error } = await resolveResumeUrl(document);
    setLoading(false);
    if (error || !resolved) { toast.error(error ?? "Could not load the resume."); return; }
    setUrl(resolved);
  }

  function handleOpen(v: boolean) {
    setOpen(v);
    if (v && !url) loadSignedUrl();
    if (!v) setUrl(null);
  }

  if (!document) {
    return (
      <Button variant="outline" size="sm" disabled title="No resume uploaded">
        <Eye className="mr-1 h-4 w-4" /> No resume
      </Button>
    );
  }

  const mime = (document.mime ?? "").toLowerCase();
  const name = document.name.toLowerCase();
  const isPdf = mime.includes("pdf") || name.endsWith(".pdf");
  const isDoc = mime.includes("msword") || mime.includes("officedocument") || name.endsWith(".doc") || name.endsWith(".docx");

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => handleOpen(true)}>
        <Eye className="mr-1 h-4 w-4" /> Preview resume
      </Button>

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="truncate pr-10">{document.name}</DialogTitle>
          </DialogHeader>

          <div className="h-[75vh] overflow-hidden rounded-md border border-border bg-black/40">
            {loading && <Centered>Loading preview…</Centered>}
            {!loading && url && isPdf && (
              <iframe src={url} title={document.name} className="h-full w-full" />
            )}
            {!loading && url && isDoc && (
              <iframe
                src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`}
                title={document.name}
                className="h-full w-full bg-white"
              />
            )}
            {!loading && url && !isPdf && !isDoc && (
              <Centered>
                <div className="text-center text-sm">
                  <p className="text-muted-foreground">Preview not supported for this file type.</p>
                  <Button asChild className="mt-3">
                    <a href={url} download={document.name}>
                      <Download className="mr-1 h-4 w-4" /> Download
                    </a>
                  </Button>
                </div>
              </Centered>
            )}
          </div>

          {url && (
            <div className="flex items-center justify-end gap-2">
              <Button asChild variant="ghost" size="sm">
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1 h-4 w-4" /> Open in new tab
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={url} download={document.name}>
                  <Download className="mr-1 h-4 w-4" /> Download
                </a>
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{children}</div>;
}
