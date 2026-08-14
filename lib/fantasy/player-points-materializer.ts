import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { calculate19FantasyPoints, type FantasyScoringConfig } from "./scoring";

export const PLAYER_POINTS_VERSION = "19fantasy-v1";

function serverClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase server-variabler mangler");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function num(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function scoringConfig(db: SupabaseClient, season: string): Promise<FantasyScoringConfig> {
  const { data, error } = await db
    .from("fantasy_scoring_rules")
    .select("key,points,position,active")
    .eq("season", season)
    .eq("active", true);
  if (error) throw error;

  const global = new Map(
    (data ?? [])
      .filter((row: any) => row.position === null || row.position === "")
      .map((row: any) => [String(row.key), num(row.points)]),
  );

  return {
    powerplayGoalBonus: global.get("powerplay_goal_bonus") ?? 0,
    powerplayAssistBonus: global.get("powerplay_assist_bonus") ?? 0,
    shorthandedGoalBonus: global.get("shorthanded_goal_bonus") ?? 0,
    shorthandedAssistBonus: global.get("shorthanded_assist_bonus") ?? 0,
    faceoffWinPoints: global.get("faceoff_win_points") ?? 0,
    faceoffWinBonus: global.get("faceoff_win_bonus") ?? 0,
  };
}

export async function materializeFantasyPlayerPointsForGame(
  gameId: string,
  options?: { db?: SupabaseClient; calculationVersion?: string },
) {
  const db = options?.db ?? serverClient();
  const version = options?.calculationVersion ?? PLAYER_POINTS_VERSION;

  const { data: game, error: gameError } = await db
    .from("fantasy_games")
    .select("id,season,status,external_id")
    .eq("id", gameId)
    .single();
  if (gameError) throw gameError;
  if (game.status !== "finished") throw new Error(`Fantasy-kamp ${game.external_id ?? game.id} er ikke ferdig.`);

  const config = await scoringConfig(db, game.season);
  const { data: stats, error: statsError } = await db
    .from("fantasy_player_game_stats")
    .select("player_id,did_play,position_snapshot,goals,assists,shots,plus_minus,pim,saves,goals_against,win,shutout,minutes_played,powerplay_goals,powerplay_assists,shorthanded_goals,shorthanded_assists,faceoffs_won,faceoffs_taken")
    .eq("game_id", gameId);
  if (statsError) throw statsError;
  if (!stats?.length) throw new Error(`Ingen kampstatistikk funnet for ${game.external_id ?? game.id}.`);

  const playerIds = [...new Set(stats.map((row: any) => row.player_id))];
  const { data: players, error: playersError } = await db
    .from("fantasy_players")
    .select("id,position")
    .in("id", playerIds);
  if (playersError) throw playersError;
  const positions = new Map((players ?? []).map((row: any) => [row.id, row.position]));

  const calculatedAt = new Date().toISOString();
  const rows = stats.map((stat: any) => {
    const position = String(stat.position_snapshot || positions.get(stat.player_id) || "W").toUpperCase();
    const breakdown = calculate19FantasyPoints(
      {
        position,
        didPlay: Boolean(stat.did_play),
        minutesPlayed: num(stat.minutes_played),
        goals: num(stat.goals),
        assists: num(stat.assists),
        shots: num(stat.shots),
        plusMinus: num(stat.plus_minus),
        pim: num(stat.pim),
        saves: num(stat.saves),
        goalsAgainst: num(stat.goals_against),
        win: Boolean(stat.win),
        shutout: Boolean(stat.shutout),
        powerplayGoals: num(stat.powerplay_goals),
        powerplayAssists: num(stat.powerplay_assists),
        shorthandedGoals: num(stat.shorthanded_goals),
        shorthandedAssists: num(stat.shorthanded_assists),
        faceoffsWon: num(stat.faceoffs_won),
        faceoffsTaken: num(stat.faceoffs_taken),
      },
      config,
    );

    return {
      player_id: stat.player_id,
      game_id: gameId,
      actual_points: breakdown.total,
      calculation_version: version,
      breakdown,
      calculated_at: calculatedAt,
    };
  });

  const { error: upsertError } = await db
    .from("fantasy_player_points")
    .upsert(rows, { onConflict: "player_id,game_id,calculation_version" });
  if (upsertError) throw upsertError;

  const playedIds = new Set(stats.filter((row: any) => row.did_play === true).map((row: any) => row.player_id));
  const pointIds = new Set(rows.map((row) => row.player_id));
  const missingPlayed = [...playedIds].filter((id) => !pointIds.has(id));
  if (missingPlayed.length) throw new Error(`${missingPlayed.length} spillere som spilte mangler materialiserte fantasy-poeng.`);

  return {
    gameId,
    season: game.season,
    calculationVersion: version,
    statRows: stats.length,
    playedRows: playedIds.size,
    pointRows: rows.length,
    totalPoints: rows.reduce((sum, row) => sum + num(row.actual_points), 0),
  };
}
