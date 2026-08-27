import { createClient } from "@supabase/supabase-js";
import { getMatchProvider, type ProviderName } from "./providers";
import { fetchHockeyLiveStandings } from "./providers/hockeylive";
import { scoreFinishedMatches } from "./score-engine";
import { syncFantasySchedule } from "./fantasy/import-service";
import { processFinishedFantasyGames } from "./fantasy/production-import";
import type { ImportedMatch } from "../types/data-provider";

export type SyncResult = {
  ok: boolean;
  provider: string;
  imported: number;
  finished: number;
  tipsScored: number;
  tipsChanged: number;
  standingsImported?: number;
  standingsError?: string;
  fantasyScheduleImported?: number;
  fantasyGames?: {
    finishedGames: number;
    alreadyComplete: number;
    queued: number;
    processed: number;
    failed: number;
    invalidExternalIds: number;
    errors: any[];
  };
  fantasyAutomation?: {
    dueRounds: number;
    teamsChecked: number;
    snapshotsCreated: number;
    alreadyFrozen: number;
    snapshotErrors: number;
    readyRounds: number;
    scoredRounds: number;
    scoredSnapshots: number;
    skippedUnfinished: number;
    skippedPointsNotReady: number;
    statusUpdates: number;
  };
  competitionCache?: {
    tippingRows: number;
    fantasyRows: number;
  };
  competitionCacheError?: string;
  fantasyError?: string;
  error?: string;
};

function canonicalStandingTeam(name: string) {
  const value = name.toLocaleLowerCase("nb-NO");
  if (value.includes("storhamar")) return "Storhamar";
  if (value.includes("oilers") || value.includes("stavanger ishockey")) return "Oilers";
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

function firstRpcRow(data: any) {
  if (Array.isArray(data)) return data[0] ?? null;
  return data ?? null;
}

function automationResult(row: any): NonNullable<SyncResult["fantasyAutomation"]> {
  return {
    dueRounds: Number(row?.due_rounds ?? 0),
    teamsChecked: Number(row?.teams_checked ?? 0),
    snapshotsCreated: Number(row?.snapshots_created ?? 0),
    alreadyFrozen: Number(row?.already_frozen ?? 0),
    snapshotErrors: Number(row?.snapshot_errors ?? 0),
    readyRounds: Number(row?.ready_rounds ?? 0),
    scoredRounds: Number(row?.scored_rounds ?? 0),
    scoredSnapshots: Number(row?.scored_snapshots ?? 0),
    skippedUnfinished: Number(row?.skipped_unfinished ?? 0),
    skippedPointsNotReady: Number(row?.skipped_points_not_ready ?? 0),
    statusUpdates: Number(row?.status_updates ?? 0),
  };
}

function combineAutomation(
  before: NonNullable<SyncResult["fantasyAutomation"]>,
  after: NonNullable<SyncResult["fantasyAutomation"]>,
): NonNullable<SyncResult["fantasyAutomation"]> {
  return {
    dueRounds: after.dueRounds,
    teamsChecked: before.teamsChecked + after.teamsChecked,
    snapshotsCreated: before.snapshotsCreated + after.snapshotsCreated,
    alreadyFrozen: before.alreadyFrozen + after.alreadyFrozen,
    snapshotErrors: before.snapshotErrors + after.snapshotErrors,
    readyRounds: after.readyRounds,
    scoredRounds: before.scoredRounds + after.scoredRounds,
    scoredSnapshots: before.scoredSnapshots + after.scoredSnapshots,
    skippedUnfinished: after.skippedUnfinished,
    skippedPointsNotReady: after.skippedPointsNotReady,
    statusUpdates: before.statusUpdates + after.statusUpdates,
  };
}

export async function syncMatches(providerName: ProviderName = "hockeylive", manualMatches: ImportedMatch[] = []): Promise<SyncResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !secretKey) {
    return {
      ok: false,
      provider: providerName,
      imported: 0,
      finished: 0,
      tipsScored: 0,
      tipsChanged: 0,
      error: "Supabase server-variabler mangler.",
    };
  }

  const provider = getMatchProvider(providerName, manualMatches);
  const startedAt = new Date().toISOString();
  const supabase = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const imported = await provider.fetchMatches();
    const rows = imported.map((match) => ({
      external_id: match.externalId,
      season: match.season,
      round: match.round,
      home_team: match.homeTeam,
      away_team: match.awayTeam,
      match_time: match.matchTime,
      home_score: match.homeScore,
      away_score: match.awayScore,
      finished: match.finished,
    }));

    if (rows.length) {
      const { error } = await supabase.from("matches").upsert(rows, { onConflict: "external_id" });
      if (error) throw error;
    }

    let reopenedTipsCleared = 0;
    const invalidExternalIds = rows
      .filter((row) => !row.finished || row.home_score === null || row.away_score === null)
      .map((row) => row.external_id);

    if (invalidExternalIds.length) {
      const { data: reopenedMatches, error: reopenedMatchError } = await supabase
        .from("matches")
        .select("id")
        .in("external_id", invalidExternalIds);
      if (reopenedMatchError) throw reopenedMatchError;

      const reopenedMatchIds = (reopenedMatches ?? []).map((match) => match.id as number);
      if (reopenedMatchIds.length) {
        const { data: clearedTips, error: clearError } = await supabase
          .from("tips")
          .update({ points: null })
          .in("match_id", reopenedMatchIds)
          .not("points", "is", null)
          .select("id");
        if (clearError) throw clearError;
        reopenedTipsCleared = clearedTips?.length ?? 0;

        const { data: staleTips, error: verifyError } = await supabase
          .from("tips")
          .select("id,match_id,points")
          .in("match_id", reopenedMatchIds)
          .not("points", "is", null)
          .limit(1);
        if (verifyError) throw verifyError;
        if (staleTips?.length) {
          throw new Error(`Kunne ikke nullstille gamle poeng for gjenåpnet kamp ${staleTips[0].match_id}.`);
        }
      }
    }

    const scoring = await scoreFinishedMatches(supabase);

    let standingsImported = 0;
    let standingsError: string | undefined;
    if (providerName === "hockeylive") {
      try {
        const standings = await fetchHockeyLiveStandings();
        const syncedAt = new Date().toISOString();
        const standingRows = standings.map((standing) => ({
          season: standing.season,
          team: canonicalStandingTeam(standing.team),
          position: standing.position,
          played: standing.played,
          points: standing.points,
          source: "hockeylive:TournamentStandings",
          synced_at: syncedAt,
        }));
        const uniqueTeams = new Set(standingRows.map((row) => row.team));
        if (uniqueTeams.size !== standingRows.length) {
          throw new Error("HockeyLive-tabellen ga duplikate lag etter navnenormalisering.");
        }
        const { error: standingError } = await supabase
          .from("ehl_standings")
          .upsert(standingRows, { onConflict: "season,team" });
        if (standingError) throw standingError;
        standingsImported = standingRows.length;
      } catch (error: any) {
        standingsError = error?.message || "Ukjent feil ved tabellsynk";
      }
    }

    let fantasyScheduleImported: number | undefined;
    let fantasyGames: SyncResult["fantasyGames"];
    let fantasyAutomation: SyncResult["fantasyAutomation"];
    let fantasyError: string | undefined;

    if (providerName === "hockeylive") {
      try {
        const schedule = await syncFantasySchedule();
        fantasyScheduleImported = schedule.imported;
        const fantasySeason = process.env.NIF_SEASON_LABEL || "2026/27";

        const { data: beforeData, error: beforeError } = await supabase.rpc(
          "process_fantasy_rounds_automation",
          { p_season: fantasySeason, p_include_test_rounds: false },
        );
        if (beforeError) throw beforeError;
        const before = automationResult(firstRpcRow(beforeData));

        const gameProcessing = await processFinishedFantasyGames({ season: fantasySeason, limit: 3 });
        fantasyGames = {
          finishedGames: gameProcessing.finishedGames,
          alreadyComplete: gameProcessing.alreadyComplete,
          queued: gameProcessing.queued,
          processed: gameProcessing.processed,
          failed: gameProcessing.failed,
          invalidExternalIds: gameProcessing.invalidExternalIds,
          errors: gameProcessing.errors,
        };

        const { data: afterData, error: afterError } = await supabase.rpc(
          "process_fantasy_rounds_automation",
          { p_season: fantasySeason, p_include_test_rounds: false },
        );
        if (afterError) throw afterError;
        const after = automationResult(firstRpcRow(afterData));
        fantasyAutomation = combineAutomation(before, after);
      } catch (error: any) {
        fantasyError = error?.message || "Ukjent feil ved Fantasy-livssyklus";
      }
    }

    let competitionCache: SyncResult["competitionCache"];
    let competitionCacheError: string | undefined;
    if (providerName === "hockeylive") {
      try {
        const fantasySeason = process.env.NIF_SEASON_LABEL || "2026/27";
        const { data: tippingRows, error: tippingCacheError } = await supabase.rpc(
          "refresh_tipping_leaderboard_cache_v1",
        );
        if (tippingCacheError) throw tippingCacheError;

        const { data: fantasyRows, error: fantasyCacheError } = await supabase.rpc(
          "refresh_fantasy_season_leaderboard_cache_v1",
          { p_season: fantasySeason },
        );
        if (fantasyCacheError) throw fantasyCacheError;

        competitionCache = {
          tippingRows: Number(tippingRows ?? 0),
          fantasyRows: Number(fantasyRows ?? 0),
        };
      } catch (error: any) {
        competitionCacheError = error?.message || "Ukjent feil ved refresh av konkurranse-cache";
      }
    }

    const operationalErrors: string[] = [];
    if (standingsError) operationalErrors.push(`Tabellsynk: ${standingsError}`);
    if (fantasyError) operationalErrors.push(`Fantasy-livssyklus: ${fantasyError}`);
    if (competitionCacheError) operationalErrors.push(`Konkurranse-cache: ${competitionCacheError}`);
    if ((fantasyGames?.failed ?? 0) > 0) {
      operationalErrors.push(`Fantasy-kampbehandling: ${fantasyGames!.failed} kamp(er) feilet`);
    }
    if ((fantasyAutomation?.snapshotErrors ?? 0) > 0) {
      operationalErrors.push(`Fantasy-snapshots: ${fantasyAutomation!.snapshotErrors} feil`);
    }
    const syncOk = operationalErrors.length === 0;
    const syncError = syncOk ? undefined : operationalErrors.join(" | ");

    const result: SyncResult = {
      ok: syncOk,
      provider: provider.name,
      imported: rows.length,
      finished: rows.filter((row) => row.finished).length,
      tipsScored: scoring.tipsScored,
      tipsChanged: scoring.tipsChanged + reopenedTipsCleared,
      standingsImported,
      ...(standingsError ? { standingsError } : {}),
      ...(fantasyScheduleImported !== undefined ? { fantasyScheduleImported } : {}),
      ...(fantasyGames ? { fantasyGames } : {}),
      ...(fantasyAutomation ? { fantasyAutomation } : {}),
      ...(competitionCache ? { competitionCache } : {}),
      ...(competitionCacheError ? { competitionCacheError } : {}),
      ...(fantasyError ? { fantasyError } : {}),
      ...(syncError ? { error: syncError } : {}),
    };

    await supabase.from("sync_runs").insert({
      provider: provider.name,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      ok: result.ok,
      imported_count: result.imported,
      finished_count: result.finished,
      error_message: result.error ?? null,
    });

    return result;
  } catch (error: any) {
    const message = error?.message || "Ukjent synkfeil";
    await supabase.from("sync_runs").insert({
      provider: provider.name,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      ok: false,
      imported_count: 0,
      finished_count: 0,
      error_message: message,
    });
    return {
      ok: false,
      provider: provider.name,
      imported: 0,
      finished: 0,
      tipsScored: 0,
      tipsChanged: 0,
      error: message,
    };
  }
}
