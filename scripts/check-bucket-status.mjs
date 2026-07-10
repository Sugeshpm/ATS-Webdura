/**
 * Recursively count files in the `resumes` bucket and compare against documents rows.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function listAll(prefix) {
  const files = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase.storage.from("resumes").list(prefix, {
      limit: 1000,
      offset,
      sortBy: { column: "name", order: "asc" }
    });
    if (error || !data) break;
    for (const e of data) {
      const full = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.id) {
        files.push({ path: full, size: e.metadata?.size ?? 0 });
      } else {
        const sub = await listAll(full);
        files.push(...sub);
      }
    }
    offset += data.length;
    if (data.length < 1000) break;
  }
  return files;
}

console.log("Walking Supabase 'resumes' bucket…");
const files = await listAll("");
const bytes = files.reduce((s, f) => s + Number(f.size ?? 0), 0);
console.log(`Total files: ${files.length}`);
console.log(`Total size:  ${(bytes / 1024 / 1024).toFixed(1)} MB`);

const { count: publicCount } = await supabase
  .from("documents")
  .select("*", { count: "exact", head: true })
  .eq("storage_bucket", "public_resumes");
const { count: supabaseCount } = await supabase
  .from("documents")
  .select("*", { count: "exact", head: true })
  .eq("storage_bucket", "resumes");
console.log(`\ndocuments rows on 'public_resumes': ${publicCount}`);
console.log(`documents rows on 'resumes':        ${supabaseCount}`);

// How many bucket files DON'T have a matching documents row?
const referenced = new Set();
const { data: refRows } = await supabase
  .from("documents")
  .select("storage_path")
  .eq("storage_bucket", "resumes");
for (const r of refRows ?? []) referenced.add(r.storage_path);
const orphanFiles = files.filter((f) => !referenced.has(f.path));
console.log(`\nBucket files with no matching documents row: ${orphanFiles.length}`);
console.log(`Reclaimable if we delete orphans: ${(orphanFiles.reduce((s, f) => s + Number(f.size ?? 0), 0) / 1024 / 1024).toFixed(1)} MB`);
if (orphanFiles.length) {
  console.log(`\nSample orphan paths:`);
  for (const f of orphanFiles.slice(0, 5)) console.log(`  ${f.path}  (${(f.size / 1024).toFixed(1)} KB)`);
}
