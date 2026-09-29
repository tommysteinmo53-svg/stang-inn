import { createClient } from "@supabase/supabase-js";
import { fetchNifMatchBundle } from "./nif-client";
import { liveMatchStats, lineupPoints, roundPoints } from "./live-points";
import type { FantasyScoringConfig } from "./scoring";

type Row = Record<string, any>;
export type LivePoints = {
  checkedAt: string;
  matches: { externalId: string; homeScore: number | null; awayScore: number | null; complete: boolean }[];
  rounds: { roundNo: number; complete: boolean; teams: { teamId: string; name: string; points: number; missing: number }[] }[];
};
async function rows(query: any): Promise<Row[]> {
  const all: Row[] = [];
  for (let offset = 0;; offset += 1000) {
    const { data, error } = await query.range(offset, offset + 999);
    if (error) throw error;
    all.push(...(data ?? []));
    if (!data || data.length < 1000) return all;
  }
}

/** Read-only projection: never writes provisional points to official scoring tables. */
export async function getLivePoints(): Promise<LivePoints> {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } });
  const now = new Date(), season = process.env.NIF_SEASON_LABEL || "2026/27";
  const result: LivePoints = { checkedAt: now.toISOString(), matches: [], rounds: [] };
  const rounds = await rows(db.from("fantasy_rounds").select("id,round_no,deadline_at")
    .eq("season", season).neq("status", "finished").lte("deadline_at", now.toISOString())
    .gte("starts_at", new Date(+now - 7 * 86400000).toISOString()).order("round_no"));
  if (!rounds.length) return result;
  const roundIds = rounds.map(r => r.id);
  const [games, snapshots, seasonRules, pointRules] = await Promise.all([
    rows(db.from("fantasy_games").select("id,external_id,starts_at,status,home_team,away_team,fantasy_round_id").in("fantasy_round_id", roundIds).order("id")),
    rows(db.from("fantasy_team_round_snapshots").select("id,round_id,team_id,team_name,captain_multiplier_override,line2_multiplier_override").in("round_id", roundIds)),
    rows(db.from("fantasy_season_rules").select("captain_multiplier,vice_captain_multiplier,vice_captain_enabled").eq("season", season)),
    rows(db.from("fantasy_scoring_rules").select("key,points,position").eq("season", season).eq("active", true)),
  ]);
  const ids = games.map(g => g.id);
  if (!ids.length) return result;
  const rules = new Map(pointRules.filter(r => !r.position).map(r => [r.key, Number(r.points)]));
  const config: FantasyScoringConfig = { powerplayGoalBonus: rules.get("powerplay_goal_bonus"), powerplayAssistBonus: rules.get("powerplay_assist_bonus"),
    shorthandedGoalBonus: rules.get("shorthanded_goal_bonus"), shorthandedAssistBonus: rules.get("shorthanded_assist_bonus"),
    faceoffWinPoints: rules.get("faceoff_win_points"), faceoffWinBonus: rules.get("faceoff_win_bonus") };
  const current = games.filter(g => g.status !== "finished" && +new Date(g.starts_at) <= +now && +new Date(g.starts_at) >= +now - 8 * 3600000);
  const live = new Map<string, ReturnType<typeof liveMatchStats>>();
  await Promise.all(current.map(async g => {
    const matchId = Number(String(g.external_id).replace(/^(hockeylive|nif):/, ""));
    if (!Number.isInteger(matchId) || matchId <= 0) return;
    const bundle = await fetchNifMatchBundle(matchId);
    const stats = liveMatchStats(bundle, g.home_team, g.away_team, config);
    live.set(g.id, stats);
    result.matches.push({ externalId: g.external_id, homeScore: stats.score?.homeScore ?? null,
      awayScore: stats.score?.awayScore ?? null, complete: stats.complete });
  }));
  if (!snapshots.length) return result;
  const [lineups, teams, players, confirmed] = await Promise.all([
    rows(db.from("fantasy_team_round_snapshot_players").select("snapshot_id,player_id,position,line_no,is_captain,is_vice_captain").in("snapshot_id", snapshots.map(s => s.id))),
    rows(db.from("fantasy_user_teams").select("id,created_at").in("id", [...new Set(snapshots.map(s => s.team_id))])),
    rows(db.from("fantasy_players").select("id,external_id").order("id")),
    rows(db.from("fantasy_player_points").select("game_id,player_id,actual_points,calculated_at,id").in("game_id", ids).order("calculated_at").order("id")),
  ]);
  const external = new Map(players.map(p => [p.id, p.external_id]));
  const created = new Map(teams.map(t => [t.id, +new Date(t.created_at)]));
  const finalPoints = new Map(confirmed.map(p => [`${p.game_id}:${p.player_id}`, Number(p.actual_points)]));
  const finishedWithPoints = new Set(confirmed.map(p => p.game_id));
  const sr = seasonRules[0] ?? {};
  for (const round of rounds) {
    const roundGames = games.filter(g => g.fantasy_round_id === round.id && +new Date(g.starts_at) <= +now);
    if (!roundGames.length) continue;
    const output = snapshots.filter(s => s.round_id === round.id && (created.get(s.team_id) ?? Infinity) <= +new Date(round.deadline_at)).map(s => {
      let total = 0, missing = 0;
      for (const p of lineups.filter(p => p.snapshot_id === s.id)) {
        let raw = 0;
        for (const g of roundGames) {
          if (g.status === "finished" && finishedWithPoints.has(g.id)) {
            raw += finalPoints.get(`${g.id}:${p.player_id}`) ?? 0;
          } else {
            const value = live.get(g.id)?.points(external.get(p.player_id) ?? "", p.position);
            if (value == null) missing++;
            else raw += value;
          }
        }
        total += lineupPoints(raw, p.line_no, p.is_captain, p.is_vice_captain, {
          captain: s.captain_multiplier_override ?? sr.captain_multiplier ?? 2,
          vice: sr.vice_captain_multiplier ?? 1.5, viceEnabled: sr.vice_captain_enabled ?? true,
          line2: s.line2_multiplier_override ?? 0.5 });
      }
      return { teamId: s.team_id, name: s.team_name, points: roundPoints(total), missing };
    }).sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, "nb"));
    result.rounds.push({ roundNo: round.round_no, complete: output.every(t => t.missing === 0), teams: output });
  }
  return result;
}
