import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(url && publishableKey);

let client: SupabaseClient | null = null;

export function getSupabaseBrowserClient() {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(url!, publishableKey!, {
      auth: {
        // A single browser client is shared across the app. Bypass the Web Locks
        // queue so concurrent getSession/PostgREST calls cannot deadlock the UI.
        lock: async (_name, _acquireTimeout, fn) => await fn(),
      },
    });
  }
  return client;
}
