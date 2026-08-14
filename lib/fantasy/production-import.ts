import { createClient } from "@supabase/supabase-js";
import { importFantasyMatch as importEnrichedFantasyMatch } from "./import-enrichment";
import { materializeFantasyPlayerPointsForGame, PLAYER_POINTS_VERSION } from "./player-points-materializer";

function serverClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase server-variabler mangler");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function numericMatchId(externalId: unknown) {
  const raw = String(externalId ?? "").trim();
  const match = raw.match(/(?:^|:)(\d+)$/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isInteger(value) && value > 0 ? value : null;
}

async function gameMaterializationState(gameId: string) {
  const db = serverClient();
  const { data: stats, error: statsError } = await db
    .from("fantasy_player_game_stats")
    .select("player_id,did_play")
    .eq("game_id", gameId);
  if (statsError) throw statsError;
  if (!stats?.length) return { complete: false, statRows: 0, playedRows: 0, pointRows: 0 };

  const playedIds = [...new Set(stats.filter((row: any) => row.did_play === true).map((row: any) => row.player_id))];
  if (!playedIds.length) return { complete: false, statRows: stats.length, playedRows: 0, pointRows: 0 };

  const { data: points, error: pointsError } = await db
    .from("fantasy_player_points")
    .select("player_id")
    .eq("game_id", gameId)
    .eq("calculation_version", PLAYER_POINTS_VERSION)
    .in("player_id", playedIds);
  if (pointsError) throw pointsError;
  const pointIds = new Set((points ?? []).map((row: any) => row.player_id));

  return {
    complete: playedIds.every((id) => pointIds.has(id)),
    statRows: stats.length,
    playedRows: playedIds.length,
    pointRows: pointIds.size,
  };
}

export async function importAndMaterializeFantasyMatch(
  matchId: number,
  options?: { season?: string; tournamentId?: string },
) {
  const db = serverClient();
  const imported = await importEnrichedFantasyMatch(matchId, options);
  const candidates = [`hockeylive:${matchId}`, String(matchId), `nif:${matchId}`];
  const { data: game, error: gameError } = await db
    .from("fantasy_games")
    .select("id,external_id,status")
    .in("external_id", candidates)
    .maybeSingle();
  if (gameError) throw gameError;
  if (!game) throw new Error(`Fant ikke fantasy-kamp ${matchId} etter import.`);
  if (game.status !== "finished") throw new Error(`Kamp ${matchId} er ikke markert ferdig etter import.`);

  const points = await materializeFantasyPlayerPointsForGame(game.id, { db });
  return { ...imported, points };
}

export async function processFinishedFantasyGames(options?: {
  season?: string;
  tournamentId?: string;
  limit?: number;
}) {
  const db = serverClient();
  const season = options?.season || process.env.NIF_SEASON_LABEL || "2026/27";
  const tournamentId = options?.tournamentId || process.env.HOCKEYLIVE_TOURNAMENT_ID || "448981";
  const limit = Math.max(1, Math.min(5, Number(options?.limit ?? 3)));

  const { data: games, error: gamesError } = await db
    .from("fantasy_games")
    .select("id,external_id,starts_at,status,season,round_no,fantasy_round_no")
    .eq("season", season)
    .eq("status", "finished")
    .order("starts_at", { ascending: true });
  if (gamesError) throw gamesError;

  const pending: any[] = [];
  let alreadyComplete = 0;
  let invalidExternalIds = 0;

  for (const game of games ?? []) {
    if (Number(game.fantasy_round_no ?? game.round_no ?? 0) >= 9000) continue;
    const matchId = numericMatchId(game.external_id);
    if (!matchId) { invalidExternalIds += 1; continue; }
    const state = await gameMaterializationState(game.id);
    if (state.complete) { alreadyComplete += 1; continue; }
    pending.push({ ...game, matchId, before: state });
    if (pending.length >= limit) break;
  }

  const processed: any[] = [];
  const errors: any[] = [];
  for (const game of pending) {
    try {
      const result = await importAndMaterializeFantasyMatch(game.matchId, { season, tournamentId });
      processed.push({
        gameId: game.id,
        externalId: game.external_id,
        matchId: game.matchId,
        statRows: result.points.statRows,
        playedRows: result.points.playedRows,
        pointRows: result.points.pointRows,
        totalPoints: result.points.totalPoints,
      });
    } catch (error: any) {
      errors.push({
        gameId: game.id,
        externalId: game.external_id,
        matchId: game.matchId,
        error: error?.message || "Ukjent fantasy-kampimportfeil",
      });
    }
  }

  return {
    season,
    tournamentId,
    limit,
    finishedGames: games?.length ?? 0,
    alreadyComplete,
    queued: pending.length,
    processed: processed.length,
    failed: errors.length,
    invalidExternalIds,
    games: processed,
    errors,
  };
}
