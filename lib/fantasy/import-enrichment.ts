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
function orgId(row: Row) { return text(row.orgId ?? row.OrgId ?? row.teamOrgId ?? row.TeamOrgId); }

function teamKey(value: any) {
  return text(value).toLocaleLowerCase("nb-NO").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "");
}
function sameTeam(a: any, b: any) {
  const ak = teamKey(a), bk = teamKey(b);
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
  const raw = text(value); if (!raw) return [];
  try { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) return parsed.map(text).filter(Boolean); } catch {}
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
function goalDiagnostic(goal: Row, index: number) {
  const keys = Object.keys(goal);
  const interesting = keys.filter((k) => /team|home|away|goal|strength|power|penalty|ice|person|score|org/i.test(k));
  const fields: Record<string,string> = {};
  for (const key of interesting.slice(0, 16)) fields[key] = text(goal[key]).slice(0, 90);
  return { index: index + 1, keys: keys.slice(0, 30), fields };
}
function goalSide(goal: Row, homeOrgIds: Set<string>, awayOrgIds: Set<string>): "home" | "away" | null {
  const scoringOrg = orgId(goal);
  if (scoringOrg && homeOrgIds.has(scoringOrg)) return "home";
  if (scoringOrg && awayOrgIds.has(scoringOrg)) return "away";

  const side = text(goal.homeOrAwayTeam ?? goal.HomeOrAwayTeam).toLowerCase();
  // HockeyLive/NIF uses H/B (hjemme/borte), while some feeds use home/away or 1/2.
  if (side === "h" || side === "home" || side === "1") return "home";
  if (side === "b" || side === "a" || side === "away" || side === "2") return "away";
  return null;
}
function plusMinusFromGoals(goals: Row[], homeTeam: string, awayTeam: string, homeOrgIds: Set<string>, awayOrgIds: Set<string>) {
  const values = new Map<string, number>();
  const add = (id: string, amount: number) => values.set(id, (values.get(id) ?? 0) + amount);
  let countedGoals = 0, skippedSpecialTeams = 0, unresolvedGoals = 0;
  const diagnostics: any[] = [];
  goals.forEach((goal, index) => {
    if (!countsForPlusMinus(goal)) { skippedSpecialTeams += 1; diagnostics.push({ ...goalDiagnostic(goal,index), result:"special-teams" }); return; }
    const homeIds = ids(goal.onIceHomeTeamPersonIDs ?? goal.OnIceHomeTeamPersonIDs);
    const awayIds = ids(goal.onIceAwayTeamPersonIDs ?? goal.OnIceAwayTeamPersonIDs);
    const scoringTeam = goal.teamName ?? goal.TeamName ?? goal.teamShortName ?? goal.TeamShortName;
    const scoringOrg = orgId(goal);

    let homeScored = Boolean(scoringOrg && homeOrgIds.has(scoringOrg));
    let awayScored = Boolean(scoringOrg && awayOrgIds.has(scoringOrg));

    // The goal row's teamName/orgId describes the scoring team directly. In this NIF feed
    // homeOrAwayTeam is the reliable source for which side that team belongs to.
    if (!homeScored && !awayScored) {
      const side = goalSide(goal, homeOrgIds, awayOrgIds);
      homeScored = side === "home";
      awayScored = side === "away";
    }
    if (!homeScored && !awayScored) {
      homeScored = sameTeam(scoringTeam, homeTeam);
      awayScored = sameTeam(scoringTeam, awayTeam);
    }
    if (!homeScored && !awayScored) {
      unresolvedGoals += 1;
      diagnostics.push({ ...goalDiagnostic(goal,index), result:"unresolved", scoringTeam:text(scoringTeam), scoringOrg, homeIds:homeIds.length, awayIds:awayIds.length });
      return;
    }
    for (const id of homeIds) add(id, homeScored ? 1 : -1);
    for (const id of awayIds) add(id, awayScored ? 1 : -1);
    countedGoals += 1;
    diagnostics.push({ ...goalDiagnostic(goal,index), result:"counted", scoringTeam:text(scoringTeam), scoringOrg, homeIds:homeIds.length, awayIds:awayIds.length });
  });
  return { values, countedGoals, skippedSpecialTeams, unresolvedGoals, diagnostics };
}

async function enrich(matchId: number) {
  const supabase = serverClient();
  const bundle = await fetchNifMatchBundle(matchId);
  const candidates = [`hockeylive:${matchId}`, String(matchId), `nif:${matchId}`];
  const { data: game, error: gameError } = await supabase.from("fantasy_games").select("id,home_team,away_team").in("external_id", candidates).maybeSingle();
  if (gameError) throw gameError;
  if (!game) throw new Error(`Fant ikke importert fantasy-kamp ${matchId}`);

  const goalieIds = new Set(bundle.goalies.map(personId).filter(Boolean));
  const memberPositions = new Map<string, Position>();
  for (const member of bundle.teamMembers) {
    const id = personId(member), pos = position(member.position);
    if (id && pos) memberPositions.set(id, pos);
  }

  const homeOrgIds = new Set<string>();
  const awayOrgIds = new Set<string>();
  for (const row of [...bundle.players, ...bundle.goalies]) {
    const oid = orgId(row);
    if (!oid) continue;
    const team = row.teamName ?? row.TeamName ?? row.teamShortName ?? row.TeamShortName;
    if (sameTeam(team, game.home_team)) homeOrgIds.add(oid);
    if (sameTeam(team, game.away_team)) awayOrgIds.add(oid);
  }

  const pm = plusMinusFromGoals(bundle.goals, game.home_team, game.away_team, homeOrgIds, awayOrgIds);
  const allIds = [...new Set([...memberPositions.keys(), ...pm.values.keys()])];
  let positionsUpdated = 0, plusMinusUpdated = 0;
  for (const id of allIds) {
    const { data: player } = await supabase.from("fantasy_players").select("id,position").eq("external_id", `nif:${id}`).maybeSingle();
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
    totalGoals: bundle.goals.length,
    teamMemberRows: bundle.teamMembers.length,
    homeOrgIds: [...homeOrgIds],
    awayOrgIds: [...awayOrgIds],
    goalDiagnostics: pm.diagnostics,
  };
}
export async function importFantasyMatch(matchId: number, options?: { season?: string; tournamentId?: string }) {
  const base = await importBaseMatch(matchId, options);
  const enrichment = await enrich(matchId);
  return { ...base, enrichment };
}
