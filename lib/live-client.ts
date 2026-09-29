import { getSupabaseBrowserClient } from "./supabase";
import type { LivePoints } from "./fantasy/live-service";
let pending: Promise<LivePoints> | null = null;
export function fetchLivePoints(): Promise<LivePoints> {
  if (!pending) pending = requestLivePoints().finally(() => { pending = null; });
  return pending;
}
async function requestLivePoints(): Promise<LivePoints> {
  const db = getSupabaseBrowserClient();
  const session = db ? (await db.auth.getSession()).data.session : null;
  if (!session) throw new Error("Logg inn for å se live-poeng.");
  const response = await fetch("/api/live-points", { headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store", signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error("Live-data er midlertidig utilgjengelig. Prøver igjen automatisk.");
  return response.json();
}
