import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { materializeFantasyPlayerPointsForGame, PLAYER_POINTS_VERSION } from "../../../../../lib/fantasy/player-points-materializer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEST_SEASON = "__e2e_player_points__";
const TEST_PREFIX = "e2e-player-points:";

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

function serverClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase server-variabler mangler");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function productionCounts(db: ReturnType<typeof serverClient>) {
  const { count: games, error: gameError } = await db
    .from("fantasy_games")
    .select("id", { count: "exact", head: true })
    .eq("season", "2026/27");
  if (gameError) throw gameError;

  const { data: productionGames, error: idsError } = await db
    .from("fantasy_games")
    .select("id")
    .eq("season", "2026/27");
  if (idsError) throw idsError;
  const gameIds = (productionGames ?? []).map((row: any) => row.id);

  let stats = 0;
  let points = 0;
  if (gameIds.length) {
    const { count: statCount, error: statError } = await db
      .from("fantasy_player_game_stats")
      .select("id", { count: "exact", head: true })
      .in("game_id", gameIds);
    if (statError) throw statError;
    stats = statCount ?? 0;

    const { count: pointCount, error: pointError } = await db
      .from("fantasy_player_points")
      .select("id", { count: "exact", head: true })
      .in("game_id", gameIds);
    if (pointError) throw pointError;
    points = pointCount ?? 0;
  }

  return { games: games ?? 0, stats, points };
}

async function cleanup(db: ReturnType<typeof serverClient>) {
  const { data: games } = await db.from("fantasy_games").select("id").eq("season", TEST_SEASON);
  const gameIds = (games ?? []).map((row: any) => row.id);
  if (gameIds.length) {
    await db.from("fantasy_games").delete().in("id", gameIds);
  }
  await db.from("fantasy_players").delete().like("external_id", `${TEST_PREFIX}%`);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const db = serverClient();
  const checks: Array<{ checkNo: number; checkName: string; passed: boolean; detail: string }> = [];
  let productionBefore: Awaited<ReturnType<typeof productionCounts>> | null = null;

  try {
    await cleanup(db);
    productionBefore = await productionCounts(db);

    const testPlayers = [
      { external_id: `${TEST_PREFIX}wing`, name: "E2E Wing", team: "E2E Home", position: "W", active: false },
      { external_id: `${TEST_PREFIX}defence`, name: "E2E Defence", team: "E2E Home", position: "D", active: false },
      { external_id: `${TEST_PREFIX}goalie`, name: "E2E Goalie", team: "E2E Home", position: "G", active: false },
      { external_id: `${TEST_PREFIX}backup`, name: "E2E Backup", team: "E2E Home", position: "G", active: false },
    ];

    const { data: players, error: playerError } = await db
      .from("fantasy_players")
      .insert(testPlayers)
      .select("id,external_id,position");
    if (playerError) throw playerError;
    const byExternal = new Map((players ?? []).map((row: any) => [row.external_id, row]));

    const { data: game, error: gameError } = await db
      .from("fantasy_games")
      .insert({
        external_id: `${TEST_PREFIX}game`,
        season: TEST_SEASON,
        round_no: 9001,
        starts_at: "2000-01-01T18:00:00.000Z",
        home_team: "E2E Home",
        away_team: "E2E Away",
        home_score: 4,
        away_score: 2,
        status: "finished",
      })
      .select("id")
      .single();
    if (gameError) throw gameError;

    const wing = byExternal.get(`${TEST_PREFIX}wing`)!;
    const defence = byExternal.get(`${TEST_PREFIX}defence`)!;
    const goalie = byExternal.get(`${TEST_PREFIX}goalie`)!;
    const backup = byExternal.get(`${TEST_PREFIX}backup`)!;

    const statRows = [
      {
        player_id: wing.id,
        game_id: game.id,
        did_play: true,
        position_snapshot: "W",
        team_snapshot: "E2E Home",
        goals: 1,
        assists: 2,
        shots: 4,
        plus_minus: 1,
        pim: 2,
        minutes_played: 18,
      },
      {
        player_id: defence.id,
        game_id: game.id,
        did_play: true,
        position_snapshot: "D",
        team_snapshot: "E2E Home",
        goals: 1,
        assists: 1,
        shots: 3,
        plus_minus: -1,
        pim: 0,
        minutes_played: 22,
      },
      {
        player_id: goalie.id,
        game_id: game.id,
        did_play: true,
        position_snapshot: "G",
        team_snapshot: "E2E Home",
        saves: 30,
        goals_against: 2,
        win: true,
        shutout: false,
        minutes_played: 60,
      },
      {
        player_id: backup.id,
        game_id: game.id,
        did_play: false,
        position_snapshot: "G",
        team_snapshot: "E2E Home",
        saves: 0,
        goals_against: 0,
        win: false,
        shutout: false,
        minutes_played: 0,
      },
    ];

    const { error: statError } = await db.from("fantasy_player_game_stats").insert(statRows);
    if (statError) throw statError;

    const first = await materializeFantasyPlayerPointsForGame(game.id, { db });
    const { data: firstPoints, error: firstPointError } = await db
      .from("fantasy_player_points")
      .select("id,player_id,actual_points,breakdown,calculation_version")
      .eq("game_id", game.id)
      .eq("calculation_version", PLAYER_POINTS_VERSION);
    if (firstPointError) throw firstPointError;

    const pointByPlayer = new Map((firstPoints ?? []).map((row: any) => [row.player_id, row]));
    const wingPoints = Number(pointByPlayer.get(wing.id)?.actual_points ?? NaN);
    const defencePoints = Number(pointByPlayer.get(defence.id)?.actual_points ?? NaN);
    const goaliePoints = Number(pointByPlayer.get(goalie.id)?.actual_points ?? NaN);
    const backupPoints = Number(pointByPlayer.get(backup.id)?.actual_points ?? NaN);

    checks.push({
      checkNo: 1,
      checkName: "Materializer oppretter én poengrad per stat-rad",
      passed: first.statRows === 4 && first.playedRows === 3 && first.pointRows === 4 && (firstPoints?.length ?? 0) === 4,
      detail: `statRows=${first.statRows} playedRows=${first.playedRows} pointRows=${first.pointRows}`,
    });

    checks.push({
      checkNo: 2,
      checkName: "Utespillerpoeng følger 19Fantasy-formelen",
      passed: wingPoints === 27 && defencePoints === 27,
      detail: `W=${wingPoints} D=${defencePoints} expected=27/27`,
    });

    checks.push({
      checkNo: 3,
      checkName: "Keeper og ubrukt reserve scores korrekt",
      passed: goaliePoints === 16 && backupPoints === 0,
      detail: `G=${goaliePoints} backup=${backupPoints} expected=16/0`,
    });

    const idsBefore = [...(firstPoints ?? []).map((row: any) => row.id)].sort();
    const second = await materializeFantasyPlayerPointsForGame(game.id, { db });
    const { data: secondPoints, error: secondPointError } = await db
      .from("fantasy_player_points")
      .select("id,actual_points")
      .eq("game_id", game.id)
      .eq("calculation_version", PLAYER_POINTS_VERSION);
    if (secondPointError) throw secondPointError;
    const idsAfter = [...(secondPoints ?? []).map((row: any) => row.id)].sort();
    const secondTotal = (secondPoints ?? []).reduce((sum: number, row: any) => sum + Number(row.actual_points ?? 0), 0);

    checks.push({
      checkNo: 4,
      checkName: "Ny materialisering er idempotent",
      passed: second.pointRows === 4 && idsBefore.join("|") === idsAfter.join("|") && secondTotal === 70,
      detail: `rows=${secondPoints?.length ?? 0} sameIds=${idsBefore.join("|") === idsAfter.join("|")} total=${secondTotal}`,
    });

    await cleanup(db);
    const productionAfter = await productionCounts(db);
    const cleanTestGames = await db.from("fantasy_games").select("id", { count: "exact", head: true }).eq("season", TEST_SEASON);
    const cleanTestPlayers = await db.from("fantasy_players").select("id", { count: "exact", head: true }).like("external_id", `${TEST_PREFIX}%`);

    checks.push({
      checkNo: 5,
      checkName: "Testdata ryddes og ekte 2026/27-data er urørt",
      passed:
        productionBefore.games === productionAfter.games &&
        productionBefore.stats === productionAfter.stats &&
        productionBefore.points === productionAfter.points &&
        (cleanTestGames.count ?? 0) === 0 &&
        (cleanTestPlayers.count ?? 0) === 0,
      detail: `prod games ${productionBefore.games}→${productionAfter.games}, stats ${productionBefore.stats}→${productionAfter.stats}, points ${productionBefore.points}→${productionAfter.points}, testGames=${cleanTestGames.count ?? 0}, testPlayers=${cleanTestPlayers.count ?? 0}`,
    });

    const passed = checks.filter((check) => check.passed).length;
    return NextResponse.json({ ok: passed === checks.length, passed, total: checks.length, checks });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "E2E-test feilet", checks }, { status: 500 });
  } finally {
    try {
      await cleanup(db);
    } catch {
      // Keep the original test result; cleanup is also explicitly verified in check 5 on success.
    }
  }
}
