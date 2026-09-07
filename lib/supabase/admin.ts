import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client for server-only background jobs (the LeetCode cron).
 * Bypasses RLS — never import this into anything reachable from the browser.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
