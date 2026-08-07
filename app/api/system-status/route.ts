import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  let supabaseOk = false;
  let supabaseDetail = "Ikke konfigurert";

  if (supabaseUrl && secretKey) {
    try {
      const supabase = createClient(supabaseUrl, secretKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error } = await supabase.from("matches").select("id", { count: "exact", head: true });
      supabaseOk = !error;
      supabaseDetail = error ? error.message : "Tilkoblet";
    } catch (error: any) {
      supabaseDetail = error?.message || "Ukjent feil";
    }
  }

  return NextResponse.json({
    app: "Stang Inn",
    version: "0.7.0",
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local",
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "local",
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID || null,
    buildTime: process.env.VERCEL_GIT_COMMIT_SHA ? new Date().toISOString() : null,
    provider: "HockeyLive",
    services: {
      github: { ok: Boolean(process.env.VERCEL_GIT_COMMIT_SHA), detail: process.env.VERCEL_GIT_COMMIT_SHA ? "Commit koblet" : "Lokal build" },
      vercel: { ok: Boolean(process.env.VERCEL), detail: process.env.VERCEL ? "Production runtime" : "Lokal runtime" },
      supabase: { ok: supabaseOk, detail: supabaseDetail },
      hockeyLive: { ok: true, detail: "Aktiv provider" },
    },
  });
}
