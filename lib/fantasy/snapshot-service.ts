import { createClient } from "@supabase/supabase-js";
import { fetchPublicHockeyLiveSeasonStats, type PublicSeasonStat } from "./public-hockeylive";

function serverClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase server-variabler mangler");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function canonicalTeam(name: string) {
  const value = name.toLocaleLowerCase("nb-NO");
  if (value.includes("storhamar")) return "Storhamar";
  if (value.includes("oilers") || value.includes("stavanger")) return "Oilers";
  if (value.includes("vålerenga") || value.includes("valerenga")) return "Vålerenga";
  if (value.includes("frisk asker")) return "Frisk Asker";
  if (value.includes("sparta")) return "Sparta";
  if (value.includes("narvik")) return "Narvik";
  if (value.includes("stjernen")) return "Stjernen";
  if (value.includes("lillehammer")) return "Lillehammer";
  if (value.includes("nidaros")) return "Nidaros";
  if (value.includes("ringerike")) return "Ringerike";
  return name.trim();
}

function snapshotRow(batchId: string, season: string, capturedAt: string, row: PublicSeasonStat) {
  return {
    batch_id: batchId,
    season,
    player_key: row.playerKey,
    name: row.name,
    team: canonicalTeam(row.team),
    kind: row.kind,
    position: row.position,
    games_played: row.gamesPlayed,
    goals: row.goals,
    assists: row.assists,
    shots: row.shots,
    plus_minus: row.plusMinus,
    pim: row.pim,
    wins: row.wins,
    shutouts: row.shutouts,
    saves: row.saves,
    goals_against: row.goalsAgainst,
    raw: row.raw,
    captured_at: capturedAt,
  };
}

export async function captureFantasySnapshot() {
  const supabase = serverClient();
  const season = process.env.NIF_SEASON_LABEL || "2026/27";
  const capturedAt = new Date().toISOString();
  const stats = await fetchPublicHockeyLiveSeasonStats();

  const { data: batch, error: batchError } = await supabase
    .from("fantasy_snapshot_batches")
    .insert({ season, source: "hockeylive-public", captured_at: capturedAt, player_rows: stats.skaters.length, goalie_rows: stats.goalies.length })
    .select("id")
    .single();
  if (batchError) throw batchError;

  const rows = [...stats.skaters, ...stats.goalies].map((row) => snapshotRow(batch.id, season, capturedAt, row));
  if (rows.length) {
    const { error } = await supabase.from("fantasy_stat_snapshots").insert(rows);
    if (error) throw error;
  }

  return { batchId: batch.id, capturedAt, skaters: stats.skaters.length, goalies: stats.goalies.length };
}

function delta(current: any, previous: any, field: string) {
  return Number(current?.[field] ?? 0) - Number(previous?.[field] ?? 0);
}

async function upsertFantasyPlayer(supabase: ReturnType<typeof serverClient>, snapshot: any) {
  const { data: existing } = await supabase.from("fantasy_players").select("id,position").eq("external_id", snapshot.player_key).maybeSingle();
  if (existing) return existing;
  const position = snapshot.kind === "goalie" ? "G" : snapshot.position || "W";
  const { data, error } = await supabase
    .from("fantasy_players")
    .upsert({ external_id: snapshot.player_key, name: snapshot.name, team: snapshot.team, position, active: true, updated_at: new Date().toISOString() }, { onConflict: "external_id" })
    .select("id,position")
    .single();
  if (error) throw error;
  return data;
}

export async function materializeLatestSnapshotDelta() {
  const supabase = serverClient();
  const season = process.env.NIF_SEASON_LABEL || "2026/27";
  const { data: batches, error: batchError } = await supabase
    .from("fantasy_snapshot_batches")
    .select("id,captured_at")
    .eq("season", season)
    .order("captured_at", { ascending: false })
    .limit(2);
  if (batchError) throw batchError;
  if (!batches || batches.length < 2) return { materialized: 0, skipped: 0, reason: "Trenger minst to snapshots" };

  const [currentBatch, previousBatch] = batches;
  const { data: currentRows, error: currentError } = await supabase.from("fantasy_stat_snapshots").select("*").eq("batch_id", currentBatch.id);
  if (currentError) throw currentError;
  const { data: previousRows, error: previousError } = await supabase.from("fantasy_stat_snapshots").select("*").eq("batch_id", previousBatch.id);
  if (previousError) throw previousError;

  const previousByKey = new Map((previousRows ?? []).map((row: any) => [`${row.kind}:${row.player_key}`, row]));
  let materialized = 0;
  let skipped = 0;

  for (const current of currentRows ?? []) {
    const previous = previousByKey.get(`${current.kind}:${current.player_key}`) as any;
    if (!previous) { skipped += 1; continue; }
    const gpDelta = delta(current, previous, "games_played");
    if (gpDelta !== 1) { if (gpDelta !== 0) skipped += 1; continue; }

    const team = canonicalTeam(current.team);
    const { data: games, error: gamesError } = await supabase
      .from("fantasy_games")
      .select("id,home_team,away_team,home_score,away_score,starts_at")
      .eq("season", season)
      .eq("status", "finished")
      .gt("starts_at", previousBatch.captured_at)
      .lte("starts_at", currentBatch.captured_at)
      .or(`home_team.eq.${team},away_team.eq.${team}`);
    if (gamesError) throw gamesError;
    if (!games || games.length !== 1) { skipped += 1; continue; }

    const game = games[0];
    const player = await upsertFantasyPlayer(supabase, current);
    const isHome = canonicalTeam(game.home_team) === team;
    const teamScore = isHome ? game.home_score : game.away_score;
    const opponentScore = isHome ? game.away_score : game.home_score;

    const statRow = {
      player_id: player.id,
      game_id: game.id,
      goals: Math.max(0, delta(current, previous, "goals")),
      assists: Math.max(0, delta(current, previous, "assists")),
      shots: Math.max(0, delta(current, previous, "shots")),
      plus_minus: delta(current, previous, "plus_minus"),
      pim: Math.max(0, delta(current, previous, "pim")),
      saves: Math.max(0, delta(current, previous, "saves")),
      goals_against: Math.max(0, delta(current, previous, "goals_against")),
      win: current.kind === "goalie" ? delta(current, previous, "wins") > 0 : null,
      shutout: current.kind === "goalie" ? delta(current, previous, "shutouts") > 0 : null,
      did_play: true,
      position_snapshot: current.kind === "goalie" ? "G" : (current.position || player.position),
      team_snapshot: team,
      raw: { source: "snapshot-delta", currentBatch: currentBatch.id, previousBatch: previousBatch.id, teamScore, opponentScore },
    };

    const { error } = await supabase.from("fantasy_player_game_stats").upsert(statRow, { onConflict: "player_id,game_id" });
    if (error) throw error;
    materialized += 1;
  }

  return { materialized, skipped, currentBatch: currentBatch.id, previousBatch: previousBatch.id };
}

export async function captureAndMaterializeFantasySnapshot() {
  const capture = await captureFantasySnapshot();
  const deltaResult = await materializeLatestSnapshotDelta();
  return { capture, delta: deltaResult };
}
