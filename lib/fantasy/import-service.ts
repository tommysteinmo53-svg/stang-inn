import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { fetchNifMatchBundle } from "./nif-client";

type Row = Record<string, any>;
type FantasyPosition = "G" | "D" | "W" | "C";

function first(...values: any[]) {
  return values.find((value) => value !== undefined && value !== null && value !== "") ?? null;
}

function n(value: any, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function text(value: any) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function position(raw: Row, goalie = false): FantasyPosition {
  if (goalie) return "G";
  const value = text(first(raw.position, raw.Position, raw.playerPosition, raw.positionCode, raw.pos)).toLowerCase();
  if (value === "d" || value.includes("def") || value.includes("back")) return "D";
  if (value === "c" || value.includes("cent")) return "C";
  if (value === "rw" || value === "lw" || value.includes("wing") || value.includes("ving")) return "W";
  // NIF may expose only a generic forward label. Treat it as provisional W;
  // a later 19Fantasy player import can overwrite W/C with the game's exact position.
  return "W";
}

function playerIdentity(raw: Row) {
  const externalId = text(first(raw.personId, raw.PersonId, raw.playerId, raw.PlayerId, raw.id, raw.Id));
  const name = text(first(raw.playerName, raw.PlayerName, raw.name, raw.Name, raw.fullName, raw.personName));
  const team = text(first(raw.teamName, raw.TeamName, raw.team, raw.Team, raw.clubName, raw.orgName));
  return { externalId, name, team };
}

function serverClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase server-variabler mangler");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function syncFantasySchedule() {
  const supabase = serverClient();
  const season = process.env.NIF_SEASON_LABEL || "2026/27";
  const { data, error } = await supabase
    .from("matches")
    .select("external_id,season,round,home_team,away_team,match_time,home_score,away_score,finished")
    .eq("season", season)
    .order("match_time");
  if (error) throw error;

  const rows = (data ?? []).map((match) => ({
    external_id: match.external_id,
    season: match.season,
    round_no: match.round,
    starts_at: match.match_time,
    home_team: match.home_team,
    away_team: match.away_team,
    home_score: match.home_score,
    away_score: match.away_score,
    status: match.finished ? "finished" : "scheduled",
    updated_at: new Date().toISOString(),
  }));

  if (rows.length) {
    const { error: upsertError } = await supabase.from("fantasy_games").upsert(rows, { onConflict: "external_id" });
    if (upsertError) throw upsertError;
  }
  return { imported: rows.length };
}

async function fantasyGame(supabase: SupabaseClient, matchId: number) {
  const candidates = [`hockeylive:${matchId}`, String(matchId), `nif:${matchId}`];
  const { data, error } = await supabase.from("fantasy_games").select("*").in("external_id", candidates).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Fant ikke fantasy-kamp for matchId ${matchId}. Kjør terminlistesynk først.`);
  return data;
}

async function upsertPlayer(supabase: SupabaseClient, raw: Row, fallbackTeam: string, goalie = false) {
  const identity = playerIdentity(raw);
  if (!identity.externalId || !identity.name) return null;
  const row = {
    external_id: `nif:${identity.externalId}`,
    name: identity.name,
    team: identity.team || fallbackTeam,
    position: position(raw, goalie),
    active: true,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("fantasy_players")
    .upsert(row, { onConflict: "external_id" })
    .select("id,external_id,name,team,position")
    .single();
  if (error) throw error;
  return data;
}

function skaterStat(raw: Row) {
  return {
    goals: n(first(raw.goals, raw.Goals, raw.g)),
    assists: n(first(raw.assists, raw.Assists, raw.a)),
    shots: n(first(raw.shotsOnGoal, raw.ShotsOnGoal, raw.sog, raw.SOG, raw.shots, raw.Shots)),
    plus_minus: n(first(raw.plusMinus, raw.PlusMinus, raw.plusminus, raw.pm)),
    pim: n(first(raw.penaltyMinutes, raw.PenaltyMinutes, raw.pim, raw.PIM)),
    powerplay_goals: n(first(raw.powerPlayGoals, raw.PowerPlayGoals, raw.ppg, raw.PPG)),
    shorthanded_goals: n(first(raw.shortHandedGoals, raw.ShortHandedGoals, raw.shg, raw.SHG)),
    game_winning_goals: n(first(raw.gameWinningGoals, raw.GameWinningGoals, raw.gwg, raw.GWG)),
    minutes_played: first(raw.timeOnIce, raw.TimeOnIce, raw.toi, raw.TOI, raw.minutesPlayed),
  };
}

function goalieStat(raw: Row) {
  return {
    saves: n(first(raw.saves, raw.Saves, raw.saveCount, raw.SaveCount)),
    goals_against: n(first(raw.goalsAgainst, raw.GoalsAgainst, raw.ga, raw.GA)),
    minutes_played: first(raw.timeOnIce, raw.TimeOnIce, raw.toi, raw.TOI, raw.minutesPlayed),
  };
}

export async function importFantasyMatch(matchId: number) {
  const supabase = serverClient();
  const game = await fantasyGame(supabase, matchId);
  const bundle = await fetchNifMatchBundle(matchId);
  let importedSkaters = 0;
  let importedGoalies = 0;
  let skipped = 0;

  for (const raw of bundle.players) {
    const identity = playerIdentity(raw);
    const fallbackTeam = identity.team || "Ukjent";
    const player = await upsertPlayer(supabase, raw, fallbackTeam, false);
    if (!player) { skipped += 1; continue; }
    const stat = skaterStat(raw);
    const { error } = await supabase.from("fantasy_player_game_stats").upsert({
      player_id: player.id,
      game_id: game.id,
      ...stat,
      did_play: true,
      position_snapshot: player.position,
      team_snapshot: player.team,
      raw,
    }, { onConflict: "player_id,game_id" });
    if (error) throw error;
    importedSkaters += 1;
  }

  for (const raw of bundle.goalies) {
    const identity = playerIdentity(raw);
    const fallbackTeam = identity.team || "Ukjent";
    const player = await upsertPlayer(supabase, raw, fallbackTeam, true);
    if (!player) { skipped += 1; continue; }
    const stat = goalieStat(raw);
    const isHome = text(player.team).toLowerCase() === text(game.home_team).toLowerCase();
    const teamScore = isHome ? game.home_score : game.away_score;
    const opponentScore = isHome ? game.away_score : game.home_score;
    const { error } = await supabase.from("fantasy_player_game_stats").upsert({
      player_id: player.id,
      game_id: game.id,
      ...stat,
      did_play: true,
      position_snapshot: "G",
      team_snapshot: player.team,
      win: teamScore !== null && opponentScore !== null ? teamScore > opponentScore : null,
      shutout: stat.goals_against === 0,
      raw,
    }, { onConflict: "player_id,game_id" });
    if (error) throw error;
    importedGoalies += 1;
  }

  return {
    matchId,
    importedSkaters,
    importedGoalies,
    skipped,
    sourceRows: {
      players: bundle.players.length,
      goalies: bundle.goalies.length,
      goals: bundle.goals.length,
      penalties: bundle.penalties.length,
    },
  };
}
