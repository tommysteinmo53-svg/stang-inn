import { createClient } from "@supabase/supabase-js";
import { importFantasyMatch as importBaseMatch } from "./import-service";
import { fetchNifMatchBundle } from "./nif-client";

type Row = Record<string, any>;
type Position = "G" | "D" | "W" | "C";

function serverClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase server-variabler mangler");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function text(value: any) { return value == null ? "" : String(value).trim(); }
function personId(row: Row) { return text(row.personId ?? row.PersonId ?? row.playerId ?? row.PlayerId); }

function teamKey(value: any) {
  return text(value)
    .toLocaleLowerCase("nb-NO")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function sameTeam(a: any, b: any) {
  const ak = teamKey(a);
  const bk = teamKey(b);
  return Boolean(ak && bk && (ak === bk || ak.includes(bk) || bk.includes(ak)));
}

function position(value: any): Position | null {
  const p = text(value).toLowerCase();
  if (!p) return null;
  if (p === "g" || p.includes("goal") || p.includes("keeper") || p.includes("målv")) return "G";
  if (p === "d" || p.includes("def") || p.includes("back")) return "D";
  if (p === "c" || p.includes("cent")) return "C";
  if (p === "f" || p === "lw" || p === "rw" || p.includes("forw") || p.includes("wing") || p.includes("ving")) return "W";
  return null;
}

function ids(value: any): string[] {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  const raw = text(value);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(text).filter(Boolean);
  } catch {}
  return raw.split(/[,;|\s]+/).map((v) => v.trim()).filter(Boolean);
}

function countsForPlusMinus(goal: Row) {
  if (goal.penaltyShot === true || String(goal.penaltyShot).toLowerCase() === "true") return false;
  const type = text(goal.goalType ?? goal.GoalType).toLowerCase();
  if (!type) return true;
  if (type.includes("power") || /(^|[^a-z])pp([^a-z]|$)/i.test(type)) return false;
  if (type.includes("penalty shot") || type.includes("shootout")) return false;
  return true;
}

function plusMinusFromGoals(goals: Row[], homeTeam: string, awayTeam: string) {
  const values = new Map<string, number>();
  const add = (id: string, amount: number) => values.set(id, (values.get(id) ?? 0) + amount);
  let countedGoals = 0;
  let skippedSpecialTeams = 0;
  let unresolvedGoals = 0;

  for (const goal of goals) {
    if (!countsForPlusMinus(goal)) { skippedSpecialTeams += 1; continue; }
    const homeIds = ids(goal.onIceHomeTeamPersonIDs ?? goal.OnIceHomeTeamPersonIDs);
    const awayIds = ids(goal.onIceAwayTeamPersonIDs ?? goal.OnIceAwayTeamPersonIDs);
    const scoringTeam = goal.teamName ?? goal.TeamName ?? goal.teamShortName ?? goal.TeamShortName;

    let homeScored = sameTeam(scoringTeam, homeTeam);
    let awayScored = sameTeam(scoringTeam, awayTeam);

    if (!homeScored && !awayScored) {
      const side = text(goal.homeOrAwayTeam ?? goal.HomeOrAwayTeam).toLowerCase();
      homeScored = side.startsWith("h") || side === "1" || side === "home";
      awayScored = side.startsWith("a") || side === "2" || side === "away";
    }

    if (!homeScored && !awayScored) { unresolvedGoals += 1; continue; }
    for (const id of homeIds) add(id, homeScored ? 1 : -1);
    for (const id of awayIds) add(id, awayScored ? 1 : -1);
    countedGoals += 1;
  }
  return { values, countedGoals, skippedSpecialTeams, unresolvedGoals };
}

async function enrich(matchId: number) {
  const supabase = serverClient();
  const bundle = await fetchNifMatchBundle(matchId);
  const candidates = [`hockeylive:${matchId}`, String(matchId), `nif:${matchId}`];
  const { data: game, error: gameError } = await supabase
    .from("fantasy_games")
    .select("id,home_team,away_team")
    .in("external_id", candidates)
    .maybeSingle();
  if (gameError) throw gameError;
  if (!game) throw new Error(`Fant ikke importert fantasy-kamp ${matchId}`);

  const goalieIds = new Set(bundle.goalies.map(personId).filter(Boolean));
  const memberPositions = new Map<string, Position>();
  for (const member of bundle.teamMembers) {
    const id = personId(member);
    const pos = position(member.position);
    if (id && pos) memberPositions.set(id, pos);
  }

  const pm = plusMinusFromGoals(bundle.goals, game.home_team, game.away_team);
  const allIds = [...new Set([...memberPositions.keys(), ...pm.values.keys()])];
  let positionsUpdated = 0;
  let plusMinusUpdated = 0;

  for (const id of allIds) {
    const externalId = `nif:${id}`;
    const { data: player } = await supabase.from("fantasy_players").select("id,position").eq("external_id", externalId).maybeSingle();
    if (!player) continue;

    const mappedPosition = memberPositions.get(id);
    if (mappedPosition && mappedPosition !== "G") {
      const { error } = await supabase.from("fantasy_players").update({ position: mappedPosition, updated_at: new Date().toISOString() }).eq("id", player.id);
      if (error) throw error;
      positionsUpdated += 1;
    }

    if (!goalieIds.has(id)) {
      const update: Record<string, any> = { plus_minus: pm.values.get(id) ?? 0 };
      if (mappedPosition && mappedPosition !== "G") update.position_snapshot = mappedPosition;
      const { error } = await supabase.from("fantasy_player_game_stats").update(update).eq("player_id", player.id).eq("game_id", game.id);
      if (error) throw error;
      plusMinusUpdated += 1;
    }
  }

  return {
    positionsUpdated,
    plusMinusUpdated,
    plusMinusCountedGoals: pm.countedGoals,
    plusMinusSkippedSpecialTeamsGoals: pm.skippedSpecialTeams,
    plusMinusUnresolvedGoals: pm.unresolvedGoals,
    teamMemberRows: bundle.teamMembers.length,
  };
}

export async function importFantasyMatch(matchId: number, options?: { season?: string; tournamentId?: string }) {
  const base = await importBaseMatch(matchId, options);
  const enrichment = await enrich(matchId);
  return { ...base, enrichment };
}
