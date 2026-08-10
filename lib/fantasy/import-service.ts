import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { fetchNifMatchBundle } from "./nif-client";

type Row = Record<string, any>;
type FantasyPosition = "G" | "D" | "W" | "C";

const HOCKEYLIVE_BASE = "https://sf34-terminlister-prod-app.azurewebsites.net/";

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

function canonicalTeamKey(value: string) {
  const name = text(value).toLocaleLowerCase("nb-NO");
  if (name.includes("nidaros")) return "nidaros";
  if (name.includes("lørenskog") || name.includes("lorenskog")) return "lorenskog";
  if (name.includes("storhamar")) return "storhamar";
  if (name.includes("stavanger") || name.includes("oilers")) return "oilers";
  if (name.includes("vålerenga") || name.includes("valerenga")) return "valerenga";
  if (name.includes("frisk")) return "frisk";
  if (name.includes("sparta")) return "sparta";
  if (name.includes("narvik")) return "narvik";
  if (name.includes("stjernen")) return "stjernen";
  if (name.includes("lillehammer")) return "lillehammer";
  if (name.includes("ringerike")) return "ringerike";
  return name.replace(/[^a-z0-9æøå]+/g, "-").replace(/^-|-$/g, "");
}

function fullName(raw: Row) {
  const direct = text(first(raw.playerName, raw.PlayerName, raw.name, raw.Name, raw.fullName, raw.personName));
  if (direct) return direct;
  return [text(first(raw.firstName, raw.FirstName)), text(first(raw.lastName, raw.LastName))].filter(Boolean).join(" ").trim();
}

function position(raw: Row, goalie = false): FantasyPosition {
  if (goalie) return "G";
  const value = text(first(raw.position, raw.Position, raw.playerPosition, raw.positionCode, raw.pos)).toLowerCase();
  if (value === "d" || value.includes("def") || value.includes("back")) return "D";
  if (value === "c" || value.includes("cent")) return "C";
  if (value === "rw" || value === "lw" || value.includes("wing") || value.includes("ving")) return "W";
  return "W";
}

function playerIdentity(raw: Row) {
  const externalId = text(first(raw.personId, raw.PersonId, raw.playerId, raw.PlayerId, raw.id, raw.Id));
  const name = fullName(raw);
  const team = text(first(raw.teamName, raw.TeamName, raw.team, raw.Team, raw.clubName, raw.orgName, raw.teamShortName));
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

function matchIdOf(raw: Row) {
  return n(first(raw.matchId, raw.MatchId, raw.matchID, raw.id, raw.Id), -1);
}

function teamName(raw: Row, side: "home" | "away") {
  if (side === "home") return text(first(raw.hometeamOverriddenName, raw.hometeam, raw.hometeamOrgName, raw.homeTeamName, raw.HomeTeamName, raw.teamNameHome));
  return text(first(raw.awayteamOverriddenName, raw.awayteam, raw.awayteamOrgName, raw.awayTeamName, raw.AwayTeamName, raw.teamNameAway));
}

function score(raw: Row, side: "home" | "away") {
  if (side === "home") return first(raw.hometeamScore, raw.homeTeamScore, raw.hometeamGoals, raw.homeTeamGoals, raw.homeScore, raw.HomeScore, raw.homeGoals);
  return first(raw.awayteamScore, raw.awayTeamScore, raw.awayteamGoals, raw.awayTeamGoals, raw.awayScore, raw.AwayScore, raw.awayGoals);
}

function startTime(raw: Row) {
  const direct = first(raw.matchStartDate, raw.MatchStartDate, raw.startDate, raw.StartDate, raw.dateTime, raw.startTimeUtc);
  if (direct) {
    const d = new Date(String(direct));
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  const date = text(first(raw.matchDate, raw.MatchDate, raw.date, raw.Date)).slice(0, 10);
  const clock = text(first(raw.matchStartTime, raw.MatchStartTime, raw.startTime)) || "00:00";
  const d = new Date(`${date}T${clock.length === 5 ? clock : "00:00"}:00+01:00`);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

async function ensureFantasyGame(supabase: SupabaseClient, matchId: number, season: string, tournamentId: string) {
  const candidates = [`hockeylive:${matchId}`, String(matchId), `nif:${matchId}`];
  const { data: existing, error } = await supabase.from("fantasy_games").select("*").in("external_id", candidates).maybeSingle();
  if (error) throw error;
  if (existing) return existing;

  const response = await fetch(`${HOCKEYLIVE_BASE}ta/TournamentMatches/?tournamentId=${encodeURIComponent(tournamentId)}`, {
    headers: { Accept: "application/json", "User-Agent": "StangInn/1.0 fantasy-import" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`TournamentMatches svarte ${response.status}`);
  const payload = await response.json();
  const rows: Row[] = Array.isArray(payload) ? payload : payload?.matches ?? payload?.data?.matches ?? [];
  const raw = rows.find((row) => matchIdOf(row) === matchId);
  if (!raw) throw new Error(`Fant ikke matchId ${matchId} i turnering ${tournamentId}`);

  const statusTypeId = n(raw.statusTypeId, 0);
  const homeScore = score(raw, "home");
  const awayScore = score(raw, "away");
  const gameRow = {
    external_id: `hockeylive:${matchId}`,
    season,
    round_no: n(first(raw.round, raw.Round, raw.roundNumber, raw.RoundNumber, raw.roundNo), 0) || null,
    starts_at: startTime(raw),
    home_team: teamName(raw, "home"),
    away_team: teamName(raw, "away"),
    home_score: homeScore === null ? null : n(homeScore),
    away_score: awayScore === null ? null : n(awayScore),
    status: statusTypeId >= 4 ? "finished" : "scheduled",
    updated_at: new Date().toISOString(),
  };
  if (!gameRow.home_team || !gameRow.away_team) throw new Error(`Kamp ${matchId} mangler lagnavn`);
  const { data, error: upsertError } = await supabase.from("fantasy_games").upsert(gameRow, { onConflict: "external_id" }).select("*").single();
  if (upsertError) throw upsertError;
  return data;
}

async function patchScoreFromGoals(supabase: SupabaseClient, game: any, goals: Row[]) {
  if (!goals.length) return game;
  const homeKey = canonicalTeamKey(game.home_team);
  const awayKey = canonicalTeamKey(game.away_team);
  let home = 0;
  let away = 0;
  for (const goal of goals) {
    const key = canonicalTeamKey(text(first(goal.teamName, goal.TeamName, goal.teamShortName, goal.TeamShortName)));
    if (key === homeKey) home += 1;
    else if (key === awayKey) away += 1;
  }
  if (home + away !== goals.length) return game;
  const { data, error } = await supabase
    .from("fantasy_games")
    .update({ home_score: home, away_score: away, status: "finished", updated_at: new Date().toISOString() })
    .eq("id", game.id)
    .select("*")
    .single();
  if (error) throw error;
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
  const playerTimeSeconds = first(raw.playerTimeSeconds, raw.PlayerTimeSeconds);
  return {
    goals: n(first(raw.goalsScored, raw.GoalsScored, raw.goals, raw.Goals, raw.g)),
    assists: n(first(raw.assists, raw.Assists, raw.a)),
    shots: n(first(raw.shots, raw.Shots, raw.shotsOnGoal, raw.ShotsOnGoal, raw.sog, raw.SOG)),
    plus_minus: n(first(raw.plusMinus, raw.PlusMinus, raw.plusminus, raw.pm)),
    pim: n(first(raw.pim, raw.PIM, raw.penaltyMinutes, raw.PenaltyMinutes)),
    powerplay_goals: n(first(raw.powerPlayGoals, raw.PowerPlayGoals, raw.ppg, raw.PPG)),
    shorthanded_goals: n(first(raw.shortHandedGoals, raw.ShortHandedGoals, raw.shg, raw.SHG)),
    game_winning_goals: n(first(raw.gameWinningGoals, raw.GameWinningGoals, raw.gwg, raw.GWG)),
    minutes_played: playerTimeSeconds !== null ? n(playerTimeSeconds) / 60 : first(raw.playerTime, raw.PlayerTime, raw.timeOnIce, raw.TimeOnIce, raw.toi, raw.TOI, raw.minutesPlayed),
  };
}

function goalieStat(raw: Row) {
  const playerTimeSeconds = first(raw.playerTimeSeconds, raw.PlayerTimeSeconds);
  return {
    saves: n(first(raw.saves, raw.Saves, raw.saveCount, raw.SaveCount, raw.savedShots, raw.SavedShots)),
    goals_against: n(first(raw.goalsAgainst, raw.GoalsAgainst, raw.ga, raw.GA)),
    minutes_played: playerTimeSeconds !== null ? n(playerTimeSeconds) / 60 : first(raw.playerTime, raw.PlayerTime, raw.timeOnIce, raw.TimeOnIce, raw.toi, raw.TOI, raw.minutesPlayed),
  };
}

export async function importFantasyMatch(matchId: number, options?: { season?: string; tournamentId?: string }) {
  const supabase = serverClient();
  const season = options?.season || "2025/26";
  const tournamentId = options?.tournamentId || "435587";
  const bundle = await fetchNifMatchBundle(matchId);
  let game = await ensureFantasyGame(supabase, matchId, season, tournamentId);
  game = await patchScoreFromGoals(supabase, game, bundle.goals);
  let importedSkaters = 0;
  let importedGoalies = 0;
  let skipped = 0;

  const goalieIds = new Set(bundle.goalies.map((row) => text(first(row.personId, row.PersonId))).filter(Boolean));

  for (const raw of bundle.players) {
    const identity = playerIdentity(raw);
    if (goalieIds.has(identity.externalId)) continue;
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
      raw: { source: "public-match-players", ...raw },
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
    const isHome = canonicalTeamKey(player.team) === canonicalTeamKey(game.home_team);
    const teamScore = isHome ? game.home_score : game.away_score;
    const opponentScore = isHome ? game.away_score : game.home_score;
    const wins = n(first(raw.wins, raw.Wins, raw.win, raw.Win));
    const shutouts = n(first(raw.shutouts, raw.Shutouts, raw.shutout, raw.Shutout));
    const { error } = await supabase.from("fantasy_player_game_stats").upsert({
      player_id: player.id,
      game_id: game.id,
      ...stat,
      did_play: true,
      position_snapshot: "G",
      team_snapshot: player.team,
      win: wins > 0 || (teamScore !== null && opponentScore !== null ? teamScore > opponentScore : null),
      shutout: shutouts > 0 || stat.goals_against === 0,
      raw: { source: "public-goalie-leaders", ...raw },
    }, { onConflict: "player_id,game_id" });
    if (error) throw error;
    importedGoalies += 1;
  }

  return {
    matchId,
    season,
    game: { home: game.home_team, away: game.away_team, homeScore: game.home_score, awayScore: game.away_score },
    importedSkaters,
    importedGoalies,
    skipped,
    sourceRows: {
      players: bundle.players.length,
      goalies: bundle.goalies.length,
      goals: bundle.goals.length,
      penalties: bundle.penalties.length,
    },
    samplePlayerFields: Object.keys(bundle.players[0] ?? {}),
    sampleGoalieFields: Object.keys(bundle.goalies[0] ?? {}),
  };
}
