import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

/**
 * Service-role Supabase client. Server-only.
 * Bypasses RLS — use ONLY in trusted server actions (e.g. user invites).
 */
export function createServiceClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local.");
  }
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
