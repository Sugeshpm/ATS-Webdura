import { createClient } from "@/lib/supabase/client";

/**
 * Resolve a document row to a viewable URL.
 *
 * Two backends:
 *   - `public_resumes` — file lives under `/public/Resumes/<storage_path>`, served
 *     directly by Vercel's static handler. URL is public (unguessable but not gated).
 *   - `resumes` (or anything else) — Supabase Storage, minted signed URL.
 */
export async function resolveResumeUrl(doc: {
  storage_bucket: string;
  storage_path: string;
  name?: string;
} | null): Promise<{ url: string | null; error: string | null }> {
  if (!doc) return { url: null, error: "No document." };

  if (doc.storage_bucket === "public_resumes") {
    // File is served straight from /public/Resumes/. Spaces in path need encoding.
    const cleaned = doc.storage_path.replace(/^[\\/]+/, "").replace(/\\/g, "/");
    return { url: `/Resumes/${encodeURI(cleaned)}`, error: null };
  }

  // Fallback: Supabase Storage — signed URL (30 min).
  const supabase = createClient();
  const opts = doc.name ? { download: doc.name } : undefined;
  const { data, error } = await supabase.storage
    .from(doc.storage_bucket)
    .createSignedUrl(doc.storage_path, 60 * 30, opts);
  if (error || !data) return { url: null, error: error?.message ?? "Could not load resume." };
  return { url: data.signedUrl, error: null };
}

/**
 * Same as resolveResumeUrl but tuned for downloads — sets Content-Disposition via the
 * `download` query param on Supabase URLs, or triggers save-as via `download` attr on
 * public URLs (which the browser handles when the anchor has a `download` attribute).
 */
export async function resolveResumeDownloadUrl(doc: {
  storage_bucket: string;
  storage_path: string;
  name: string;
} | null): Promise<{ url: string | null; error: string | null }> {
  return resolveResumeUrl(doc);
}
