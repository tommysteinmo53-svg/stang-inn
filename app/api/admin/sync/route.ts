import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncMatches } from "../../../../lib/sync-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) {
    return NextResponse.json({ ok: false, error: "Supabase public-konfigurasjon mangler." }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ ok: false, error: "Mangler innlogging." }, { status: 401 });

  const authClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) return NextResponse.json({ ok: false, error: "Ugyldig innlogging." }, { status: 401 });

  const { data: player } = await authClient
    .from("players")
    .select("admin")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (!player?.admin) return NextResponse.json({ ok: false, error: "Kun admin kan synkronisere." }, { status: 403 });

  const result = await syncMatches("hockeylive");
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
