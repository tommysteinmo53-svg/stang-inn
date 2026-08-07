import { createClient } from "@supabase/supabase-js";
import { getMatchProvider, type ProviderName } from "./providers";
import { scoreFinishedMatches } from "./score-engine";
import type { ImportedMatch } from "../types/data-provider";

export type SyncResult = {
  ok: boolean;
  provider: string;
  imported: number;
  finished: number;
  tipsScored: number;
  tipsChanged: number;
  error?: string;
};

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

    // Idempotent poengmotor: kjøres etter hver synk. Dersom HockeyLive korrigerer
    // et resultat senere, korrigeres også tips-poengene automatisk neste gang.
    const scoring = await scoreFinishedMatches(supabase);

    const result: SyncResult = {
      ok: true,
      provider: provider.name,
      imported: rows.length,
      finished: rows.filter((row) => row.finished).length,
      tipsScored: scoring.tipsScored,
      tipsChanged: scoring.tipsChanged,
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
