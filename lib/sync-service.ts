import { createClient } from "@supabase/supabase-js";
import { getMatchProvider, type ProviderName } from "./providers";
import { fetchHockeyLiveStandings } from "./providers/hockeylive";
import { scoreFinishedMatches } from "./score-engine";
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

    const result: SyncResult = {
      ok: true,
      provider: provider.name,
      imported: rows.length,
      finished: rows.filter((row) => row.finished).length,
      tipsScored: scoring.tipsScored,
      tipsChanged: scoring.tipsChanged + reopenedTipsCleared,
      standingsImported,
      ...(standingsError ? { standingsError } : {}),
    };

    await supabase.from("sync_runs").insert({
      provider: provider.name,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      ok: true,
      imported_count: result.imported,
      finished_count: result.finished,
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
