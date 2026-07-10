/**
 * One-shot cleanup: delete Supabase Storage objects in the `resumes` bucket
 * that have no matching `documents` row.
 *
 * Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local.
 * Never runs on hosted deploy — this is a local admin tool.
 *
 * Usage:
 *   node scripts/cleanup-orphan-resumes.mjs           # dry-run: lists count, does nothing
 *   node scripts/cleanup-orphan-resumes.mjs --delete  # actually deletes
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// ---------- Load .env.local manually (no dotenv dep needed) ----------
try {
  const env = readFileSync(".env.local", "utf8");
  for (const line of env.split(/\r?\n/)) {
    // Skip comments and blanks
    if (!line || /^\s*#/.test(line)) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const rawKey = line.slice(0, eq).trim();
    let rawVal = line.slice(eq + 1).trim();
    // Strip matching surrounding quotes
    if ((rawVal.startsWith('"') && rawVal.endsWith('"')) || (rawVal.startsWith("'") && rawVal.endsWith("'"))) {
      rawVal = rawVal.slice(1, -1);
    }
    if (rawKey && rawVal) process.env[rawKey] = rawVal;
  }
} catch (e) {
  console.error("Could not read .env.local — run this from the project root.");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

function mask(s) { return s ? s.slice(0, 12) + "…" + s.slice(-6) : "(missing)"; }
console.log("Loaded environment:");
console.log("  NEXT_PUBLIC_SUPABASE_URL =", url ?? "(missing)");
console.log("  SUPABASE_SERVICE_ROLE_KEY =", mask(key));

if (!url || !key) {
  console.error("\nMissing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  process.exit(1);
}

// Sanity-check URL shape
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) {
  console.error(`\nURL doesn't look right. Expected format: https://<project-ref>.supabase.co`);
  console.error(`Got: "${url}"`);
  console.error("Check .env.local — no trailing slashes/paths, no extra quotes, no trailing whitespace.");
  process.exit(1);
}

// Reachability probe
console.log("\nChecking network reachability…");
try {
  const probe = await fetch(url + "/auth/v1/health", { method: "GET" });
  console.log(`  ${url} → HTTP ${probe.status}`);
} catch (e) {
  console.error(`  ${url} → network error: ${e.message}`);
  console.error("\nCauses:");
  console.error("  - DNS can't resolve the project — check the URL for typos");
  console.error("  - Firewall/VPN/proxy is blocking outbound HTTPS");
  console.error("  - The project is paused (Supabase pauses inactive free projects)");
  process.exit(1);
}
console.log();

const DELETE_FLAG = process.argv.includes("--delete");
const BATCH = 100;

const supabase = createClient(url, key, { auth: { persistSession: false } });

// ---------- Fetch orphan paths ----------
console.log("Fetching orphan resume paths…");
const { data: rows, error: rpcErr } = await supabase.rpc("list_orphan_resume_paths");
if (rpcErr) {
  console.error("RPC failed:", rpcErr.message);
  console.error("Did you run the CREATE FUNCTION statement in the SQL editor?");
  process.exit(1);
}
const paths = (rows ?? []).map((r) => r.name).filter(Boolean);
console.log(`Found ${paths.length} orphan objects in the 'resumes' bucket.`);

if (!paths.length) {
  console.log("Nothing to clean up. Bucket is tidy.");
  process.exit(0);
}

// ---------- Dry-run summary ----------
if (!DELETE_FLAG) {
  console.log("\nDry run — pass --delete to actually remove them.");
  console.log("First 5 sample paths:");
  for (const p of paths.slice(0, 5)) console.log(`  ${p}`);
  process.exit(0);
}

// ---------- Actual delete ----------
console.log(`\nDeleting ${paths.length} objects in batches of ${BATCH}…\n`);

let deleted = 0;
let failed = 0;
const failures = [];

for (let i = 0; i < paths.length; i += BATCH) {
  const batch = paths.slice(i, i + BATCH);
  const { data, error } = await supabase.storage.from("resumes").remove(batch);
  if (error) {
    failed += batch.length;
    failures.push({ start: i, error: error.message });
    console.log(`  batch ${i / BATCH + 1}: ERROR — ${error.message}`);
  } else {
    deleted += (data ?? []).length || batch.length;
    process.stdout.write(`\r  ${deleted} / ${paths.length} deleted`);
  }
}

console.log(`\n\nDone.`);
console.log(`Deleted: ${deleted}`);
console.log(`Failed:  ${failed}`);
if (failures.length) {
  console.log("\nFailure samples:");
  for (const f of failures.slice(0, 3)) console.log(`  batch @${f.start}: ${f.error}`);
}
console.log(
  "\nStorage usage in the dashboard may take up to an hour to reflect the drop " +
  "as Supabase's background reaper clears the underlying blobs."
);
