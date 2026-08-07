import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { scoreFinishedMatches } from "../../../../lib/score-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function adminClients(request: NextRequest) {
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
  const ctx = await adminClients(request);
  if ("error" in ctx) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status });
  const body = await request.json().catch(() => ({}));

  if (body.action === "recalculate") {
    try {
      const result = await scoreFinishedMatches(ctx.service);
      return NextResponse.json({ ok: true, ...result });
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e?.message || "Kunne ikke beregne poeng." }, { status: 500 });
    }
  }

  if (body.action === "save_points") {
    const exact = Number(body.exact);
    const outcome = Number(body.outcome);
    if (!Number.isFinite(exact) || !Number.isFinite(outcome) || exact < 0 || outcome < 0) {
      return NextResponse.json({ ok: false, error: "Poengverdiene må være positive tall." }, { status: 400 });
    }
    const { error } = await ctx.service.from("app_settings").upsert({ key: "points", value: { exact, outcome }, updated_at: new Date().toISOString() });
    if (error) return NextResponse.json({ ok: false, error: `${error.message} Kjør supabase/v0.7-admin-tools.sql hvis tabellen mangler.` }, { status: 400 });
    const scored = await scoreFinishedMatches(ctx.service);
    return NextResponse.json({ ok: true, ...scored });
  }

  if (body.action === "announce") {
    const message = String(body.message || "").trim();
    if (!message) return NextResponse.json({ ok: false, error: "Meldingen kan ikke være tom." }, { status: 400 });
    const { error } = await ctx.service.from("announcements").insert({ message, active: true, created_by: ctx.userId });
    if (error) return NextResponse.json({ ok: false, error: `${error.message} Kjør supabase/v0.7-admin-tools.sql hvis tabellen mangler.` }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  const home = String(body.home_team || "").trim();
  const away = String(body.away_team || "").trim();
  if (!home || !away) return NextResponse.json({ ok: false, error: "Hjemmelag og bortelag må fylles ut." }, { status: 400 });

  const row = {
    external_id: `manual-${crypto.randomUUID()}`,
    season: body.season || "2026/27",
    round: body.round === "" || body.round == null ? null : Number(body.round),
    home_team: home,
    away_team: away,
    match_time: body.match_time || null,
    home_score: body.home_score === "" || body.home_score == null ? null : Number(body.home_score),
    away_score: body.away_score === "" || body.away_score == null ? null : Number(body.away_score),
    finished: Boolean(body.finished),
  };
  const { data, error } = await ctx.service.from("matches").insert(row).select("*").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, match: data });
}

export async function PATCH(request: NextRequest) {
  const ctx = await adminClients(request);
  if ("error" in ctx) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status });
  const body = await request.json().catch(() => ({}));
  const id = Number(body.id);
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: "Ugyldig kamp-ID." }, { status: 400 });

  const patch: Record<string, unknown> = {};
  for (const key of ["home_team", "away_team", "season"] as const) if (body[key] !== undefined) patch[key] = String(body[key]).trim();
  if (body.round !== undefined) patch.round = body.round === "" || body.round == null ? null : Number(body.round);
  if (body.match_time !== undefined) patch.match_time = body.match_time || null;
  if (body.home_score !== undefined) patch.home_score = body.home_score === "" || body.home_score == null ? null : Number(body.home_score);
  if (body.away_score !== undefined) patch.away_score = body.away_score === "" || body.away_score == null ? null : Number(body.away_score);
  if (body.finished !== undefined) patch.finished = Boolean(body.finished);

  const { data, error } = await ctx.service.from("matches").update(patch).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  if (patch.finished === true) await scoreFinishedMatches(ctx.service);
  return NextResponse.json({ ok: true, match: data });
}

export async function DELETE(request: NextRequest) {
  const ctx = await adminClients(request);
  if ("error" in ctx) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status });
  const body = await request.json().catch(() => ({}));
  const id = Number(body.id);
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: "Ugyldig kamp-ID." }, { status: 400 });
  const { error } = await ctx.service.from("matches").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
