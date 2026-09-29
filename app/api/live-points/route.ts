import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { getLivePoints } from "../../../lib/fantasy/live-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
// All authenticated users share the same read-only projection. No tokens/user data in cache.
const live = unstable_cache(getLivePoints, ["live-points-v1"], { revalidate: 30 });
export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return NextResponse.json({ error: "Du må være logget inn." }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !process.env.SUPABASE_SECRET_KEY) return NextResponse.json({ error: "Live er ikke tilgjengelig." }, { status: 503 });
  const auth = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await auth.auth.getUser(token);
  if (error || !data.user) return NextResponse.json({ error: "Logg inn på nytt." }, { status: 401 });
  try {
    return NextResponse.json(await live(), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Live projection failed", error);
    return NextResponse.json({ error: "Kunne ikke hente live-poeng. Prøver igjen automatisk." }, { status: 503 });
  }
}
