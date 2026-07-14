"use client";
import * as React from "react";
import { Eye, Download, ExternalLink, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { resolveResumeUrl, resolveResumeDownloadUrl } from "@/lib/resume-url";

interface Props {
  document: {
    id: string;
    name: string;
    mime: string | null;
    storage_bucket: string;
    storage_path: string;
  } | null;
  /** When true, renders the trigger as an icon-only button (used in the table row). */
  iconOnly?: boolean;
}

/**
 * Resume preview button + modal.
 *
 * Two URLs are minted on demand:
 *   - `previewUrl` (inline, no attachment disposition) → drives the iframe
 *   - `downloadUrl` (with attachment disposition) → drives the Download button
 *
 * They're minted lazily on modal open. Neither is fetched at render time.
 */
export function ResumePreviewButton({ document, iconOnly = false }: Props) {
  const [open, setOpen] = React.useState(false);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function loadUrls() {
    if (!document) return;
    setLoading(true);
    // Fetch preview + download URLs in parallel so the Download button is ready as soon
    // as the modal shows.
    const [prev, dl] = await Promise.all([
      resolveResumeUrl(document),
      resolveResumeDownloadUrl({ ...document, name: document.name })
    ]);
    setLoading(false);
    if (prev.error || !prev.url) { toast.error(prev.error ?? "Could not load the resume."); return; }
    setPreviewUrl(prev.url);
    setDownloadUrl(dl.url ?? prev.url);
  }

  function handleOpen(v: boolean) {
    setOpen(v);
    if (v && !previewUrl) loadUrls();
    if (!v) { setPreviewUrl(null); setDownloadUrl(null); }
  }

  if (!document) {
    return iconOnly ? (
      <button
        type="button"
        disabled
        title="No resume uploaded"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground opacity-40"
        aria-label="No resume"
      >
        <FileText className="h-4 w-4" />
      </button>
    ) : (
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
      {iconOnly ? (
        <button
          type="button"
          onClick={() => handleOpen(true)}
          title="Preview resume"
          aria-label="Preview resume"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <FileText className="h-4 w-4" />
        </button>
      ) : (
        <Button variant="outline" size="sm" onClick={() => handleOpen(true)}>
          <Eye className="mr-1 h-4 w-4" /> Preview resume
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="truncate pr-10">{document.name}</DialogTitle>
          </DialogHeader>

          <div className="h-[75vh] overflow-hidden rounded-md border border-border bg-black/40">
            {loading && <Centered>Loading preview…</Centered>}
            {!loading && previewUrl && isPdf && (
              // #toolbar=1 keeps Chrome's PDF toolbar visible; #view=FitH fits width nicely
              <iframe
                src={`${previewUrl}#view=FitH&toolbar=1`}
                title={document.name}
                className="h-full w-full"
              />
            )}
            {!loading && previewUrl && isDoc && (
              <iframe
                src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewUrl)}`}
                title={document.name}
                className="h-full w-full bg-white"
              />
            )}
            {!loading && previewUrl && !isPdf && !isDoc && (
              <Centered>
                <div className="text-center text-sm">
                  <p className="text-muted-foreground">Preview not supported for this file type.</p>
                  {downloadUrl && (
                    <Button asChild className="mt-3">
                      <a href={downloadUrl} download={document.name}>
                        <Download className="mr-1 h-4 w-4" /> Download
                      </a>
                    </Button>
                  )}
                </div>
              </Centered>
            )}
          </div>

          {(previewUrl || downloadUrl) && (
            <div className="flex items-center justify-end gap-2">
              {previewUrl && (
                <Button asChild variant="ghost" size="sm">
                  <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-1 h-4 w-4" /> Open in new tab
                  </a>
                </Button>
              )}
              {downloadUrl && (
                <Button asChild variant="outline" size="sm">
                  <a href={downloadUrl} download={document.name}>
                    <Download className="mr-1 h-4 w-4" /> Download
                  </a>
                </Button>
              )}
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
