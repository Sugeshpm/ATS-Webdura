/**
 * One-shot migration: repoint existing `documents` rows away from Supabase Storage
 * and onto the public folder (`/public/Resumes/`).
 *
 * Strategy:
 *   1. Walk `public/Resumes/**` and index files by basename → [relative paths].
 *   2. For each `documents` row where storage_bucket = 'resumes':
 *        a. Try to match by basename(storage_path) or `name` column.
 *        b. If exactly one file on disk matches → update the row:
 *              storage_bucket = 'public_resumes'
 *              storage_path   = <relative path under public/Resumes/, forward slashes>
 *        c. If zero or >1 match → skip and log for manual review.
 *
 * Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local.
 * Uses the service-role client so RLS won't interfere with the batch update.
 *
 * Usage:
 *   node scripts/migrate-resumes-to-public.mjs           # dry-run
 *   node scripts/migrate-resumes-to-public.mjs --apply   # write changes
 */

import { readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

// ---------- Load .env.local ----------
try {
  const env = readFileSync(".env.local", "utf8");
  for (const line of env.split(/\r?\n/)) {
    if (!line || /^\s*#/.test(line)) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (k && v) process.env[k] = v;
  }
} catch {
  console.error("Could not read .env.local — run this from the project root.");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");
const ROOT = path.join(process.cwd(), "public", "Resumes");

// ---------- Walk public/Resumes/**/* ----------
console.log(`Indexing files under ${ROOT}…`);
async function walk(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walk(full, out);
    else if (e.isFile()) out.push(full);
  }
  return out;
}

let allFiles;
try {
  allFiles = await walk(ROOT);
} catch (e) {
  console.error(`Could not read ${ROOT}: ${e.message}`);
  process.exit(1);
}

const byBasename = new Map(); // lowercased basename → [rel path, ...]
for (const abs of allFiles) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, "/");
  const base = path.basename(rel).toLowerCase();
  const list = byBasename.get(base) ?? [];
  list.push(rel);
  byBasename.set(base, list);
}
console.log(`Indexed ${allFiles.length} files (${byBasename.size} unique basenames).`);

// ---------- Fetch documents rows to migrate ----------
const supabase = createClient(url, key, { auth: { persistSession: false } });

console.log("\nFetching resume rows on storage_bucket='resumes'…");
const rows = [];
const PAGE = 1000;
for (let from = 0; ; from += PAGE) {
  const { data, error } = await supabase
    .from("documents")
    .select("id, name, storage_bucket, storage_path, candidate_id")
    .eq("storage_bucket", "resumes")
    .eq("kind", "resume")
    .order("id")
    .range(from, from + PAGE - 1);
  if (error) { console.error("Fetch failed:", error.message); process.exit(1); }
  if (!data?.length) break;
  rows.push(...data);
  if (data.length < PAGE) break;
}
console.log(`Found ${rows.length} rows to consider.`);

// ---------- Fetch each candidate's most likely job folder (for disambiguation) ----------
// Join applications → jobs to get the job title so we can prefer a matching folder.
console.log("\nFetching job titles for candidates (used only to break ambiguity)…");
const candidateIds = [...new Set(rows.map((r) => r.candidate_id).filter(Boolean))];
const jobTitleByCandidate = new Map(); // candidate_id → Set(lowercased job titles)
for (let i = 0; i < candidateIds.length; i += 100) {
  const batch = candidateIds.slice(i, i + 100);
  const { data, error } = await supabase
    .from("applications")
    .select("candidate_id, jobs(title)")
    .in("candidate_id", batch);
  if (error) { console.error("applications fetch failed:", error.message); process.exit(1); }
  for (const app of data ?? []) {
    const title = app.jobs?.title?.trim().toLowerCase();
    if (!title) continue;
    const set = jobTitleByCandidate.get(app.candidate_id) ?? new Set();
    set.add(title);
    jobTitleByCandidate.set(app.candidate_id, set);
  }
}
console.log(`Loaded job titles for ${jobTitleByCandidate.size} candidates.`);

// ---------- Match ----------
let matched = 0, ambiguous = 0, missing = 0;
const updates = [];
const misses = [];
const dupes = [];

for (const row of rows) {
  const spBase = path.basename(row.storage_path ?? "").toLowerCase();
  const nameBase = (row.name ?? "").toLowerCase();

  let candidates = byBasename.get(spBase) ?? [];
  if (candidates.length === 0 && nameBase && nameBase !== spBase) {
    candidates = byBasename.get(nameBase) ?? [];
  }

  if (candidates.length === 1) {
    matched++;
    updates.push({ id: row.id, storage_path: candidates[0] });
    continue;
  }

  if (candidates.length > 1) {
    // Try to disambiguate: prefer a file whose top-level folder matches one of
    // this candidate's known job titles.
    const titles = jobTitleByCandidate.get(row.candidate_id) ?? new Set();
    const preferred = candidates.filter((rel) => {
      const topFolder = rel.split("/")[0]?.toLowerCase();
      return topFolder && titles.has(topFolder);
    });
    if (preferred.length === 1) {
      matched++;
      updates.push({ id: row.id, storage_path: preferred[0] });
      continue;
    }
    ambiguous++;
    dupes.push({ id: row.id, name: row.name, matches: candidates });
    continue;
  }

  missing++;
  misses.push({ id: row.id, name: row.name, storage_path: row.storage_path });
}

console.log(`\nMatch summary:`);
console.log(`  Exact single match: ${matched}`);
console.log(`  Ambiguous (>1 file with same name): ${ambiguous}`);
console.log(`  No file on disk: ${missing}`);

if (dupes.length) {
  console.log(`\nFirst 5 ambiguous rows (need manual review):`);
  for (const d of dupes.slice(0, 5)) console.log(`  ${d.id}  ${d.name}  →  ${d.matches.length} matches`);
}
if (misses.length) {
  console.log(`\nFirst 5 rows with no file on disk:`);
  for (const m of misses.slice(0, 5)) console.log(`  ${m.id}  ${m.name}  (was: ${m.storage_path})`);
}

if (!APPLY) {
  console.log(`\nDry run — no changes made. Pass --apply to update ${updates.length} rows.`);
  process.exit(0);
}

// ---------- Apply updates ----------
console.log(`\nApplying ${updates.length} updates in batches…`);
const BATCH = 200;
let ok = 0, fail = 0;
const failures = [];

for (let i = 0; i < updates.length; i += BATCH) {
  const batch = updates.slice(i, i + BATCH);
  // No .update() batching in supabase-js — do it row-by-row.
  await Promise.all(
    batch.map(async (u) => {
      const { error } = await supabase
        .from("documents")
        .update({ storage_bucket: "public_resumes", storage_path: u.storage_path })
        .eq("id", u.id);
      if (error) { fail++; failures.push({ id: u.id, error: error.message }); }
      else ok++;
    })
  );
  process.stdout.write(`\r  ${ok + fail} / ${updates.length}`);
}

console.log(`\n\nDone.`);
console.log(`Updated: ${ok}`);
console.log(`Failed:  ${fail}`);
if (failures.length) {
  console.log(`\nFirst 3 failures:`);
  for (const f of failures.slice(0, 3)) console.log(`  ${f.id}: ${f.error}`);
}
console.log(
  `\nRemaining rows on storage_bucket='resumes' will keep serving from Supabase ` +
  `via signed URLs (fallback branch in src/lib/resume-url.ts).`
);
