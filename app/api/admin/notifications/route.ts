import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function adminContext(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !publicKey || !secretKey) return { error: "Supabase-konfigurasjon mangler.", status: 503 } as const;

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { error: "Mangler innlogging.", status: 401 } as const;

  const auth = createClient(url, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData } = await auth.auth.getUser(token);
  if (!userData.user) return { error: "Ugyldig innlogging.", status: 401 } as const;
  const { data: player } = await auth.from("players").select("admin").eq("id", userData.user.id).maybeSingle();
  if (!player?.admin) return { error: "Kun administrator har tilgang.", status: 403 } as const;

  const service = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return { service, userId: userData.user.id } as const;
}

export async function POST(request: NextRequest) {
  const ctx = await adminContext(request);
  if ("error" in ctx) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status });

  const body = await request.json().catch(() => ({}));
  const title = String(body.title || "").trim();
  const message = String(body.message || "").trim();
  if (!title || !message) return NextResponse.json({ ok: false, error: "Tittel og melding må fylles ut." }, { status: 400 });

  const row = {
    user_id: body.user_id || null,
    type: String(body.type || "info"),
    title,
    message,
    link: body.link ? String(body.link) : null,
    created_by: ctx.userId,
    expires_at: body.expires_at || null,
  };

  const { data, error } = await ctx.service.from("notifications").insert(row).select("*").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, notification: data });
}
