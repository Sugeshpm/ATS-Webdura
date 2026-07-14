import { createClient } from "@/lib/supabase/client";

/**
 * Resolve a document row to a URL suitable for INLINE PREVIEW (iframe).
 *
 * Backends:
 *   - `public_resumes` — file lives under `/public/Resumes/<storage_path>`, served
 *     directly by Vercel's static handler with `Content-Type: application/pdf` and
 *     no attachment disposition, so the browser previews it inline.
 *   - `resumes` (or anything else) — Supabase Storage, minted signed URL WITHOUT
 *     the `download` option. Passing `download` would stamp the response with
 *     `Content-Disposition: attachment`, which forces the browser to save the
 *     file instead of rendering it — the exact bug that broke preview.
 */
export async function resolveResumeUrl(doc: {
  storage_bucket: string;
  storage_path: string;
  name?: string;
} | null): Promise<{ url: string | null; error: string | null }> {
  if (!doc) return { url: null, error: "No document." };

  if (doc.storage_bucket === "public_resumes") {
    const cleaned = doc.storage_path.replace(/^[\\/]+/, "").replace(/\\/g, "/");
    return { url: `/Resumes/${encodeURI(cleaned)}`, error: null };
  }

  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(doc.storage_bucket)
    .createSignedUrl(doc.storage_path, 60 * 30);       // no `download` — inline preview
  if (error || !data) return { url: null, error: error?.message ?? "Could not load resume." };
  return { url: data.signedUrl, error: null };
}

/**
 * Resolve a document row to a URL suitable for SAVING (triggers the browser
 * download dialog with the correct filename).
 *
 *   - `public_resumes` — same-origin URL; the caller pairs this with a
 *     `<a href={url} download={name}>` element and the browser handles it.
 *   - `resumes` — Supabase signed URL WITH `download: <name>`, which stamps
 *     `Content-Disposition: attachment; filename=<name>` on the response so
 *     cross-origin download works (the `<a download>` attribute is ignored
 *     for cross-origin URLs, so this header is the only reliable trigger).
 */
export async function resolveResumeDownloadUrl(doc: {
  storage_bucket: string;
  storage_path: string;
  name: string;
} | null): Promise<{ url: string | null; error: string | null }> {
  if (!doc) return { url: null, error: "No document." };

  if (doc.storage_bucket === "public_resumes") {
    const cleaned = doc.storage_path.replace(/^[\\/]+/, "").replace(/\\/g, "/");
    return { url: `/Resumes/${encodeURI(cleaned)}`, error: null };
  }

  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(doc.storage_bucket)
    .createSignedUrl(doc.storage_path, 60 * 30, { download: doc.name });
  if (error || !data) return { url: null, error: error?.message ?? "Could not load resume." };
  return { url: data.signedUrl, error: null };
}
