import { clamp } from "./market-calibration";
import type { ImportHistory } from "./import-history-2026";

export type V43Position = "C" | "W" | "D" | "G";

export type ImportEstimateV43 = {
  raw: number;
  prior: number;
  weight: number;
  translation: number;
  confidence: "Høy" | "Middels" | "Lav";
  metric: string;
  note: string;
};

// V4.3 deliberately separates league translation from the starting-price prior.
// V4.2 used the EHL positional median as the prior for every new player, which
// made productive Norway2 players look like established EHL stars before their
// production adjustment was even applied.
export const NEW_PLAYER_PRIOR_M: Record<V43Position, number> = {
  C: 6.5,
  W: 6.0,
  D: 4.5,
  G: 7.0,
};

// Translation is the expected portability of production/quality into EHL,
// not a ranking of leagues. Lower-level and junior production is regressed
// substantially harder than in V4.2.
export const LEAGUE_TRANSLATION_V43: Record<string, number> = {
  NHL: 1.08,
  AHL: 1.04,
  SHL: 1.00,
  Liiga: 0.98,
  NL: 0.98,
  DEL: 0.92,
  HockeyAllsvenskan: 0.78,
  ICEHL: 0.76,
  Slovakia: 0.75,
  ECHL: 0.72,
  EIHL: 0.70,
  "Metal Ligaen": 0.66,
  Poland: 0.62,
  Mestis: 0.62,
  Latvia: 0.58,
  HockeyEttan: 0.56,
  USHL: 0.50,
  NAHL: 0.44,
  Norway2: 0.42,
  "J20 Nationell": 0.36,
  "Norway U20": 0.30,
  "Norway U18": 0.22,
};

const BOUNDS: Record<V43Position, [number, number]> = {
  C: [3.5, 18],
  W: [3.0, 18],
  D: [2.0, 14],
  G: [4.0, 17],
};

function leaguePriorAdjustment(league: string, pos: V43Position) {
  const t = LEAGUE_TRANSLATION_V43[league] ?? 0.5;
  // Proven top-league imports deserve a higher prior even with modest P/GP;
  // lower-league scorers do not get that privilege.
  const premium = t >= 0.98 ? 2.5 : t >= 0.9 ? 1.75 : t >= 0.75 ? 1.0 : t >= 0.6 ? 0.4 : 0;
  const goalieScale = pos === "G" ? 1.15 : 1;
  return premium * goalieScale;
}

function sampleWeight(games: number, junior = false) {
  const base = clamp(games / 45, 0.18, 0.82);
  return junior ? base * 0.65 : base;
}

function nonlinearDelta(value: number, limit: number) {
  // tanh-like saturation without Math.tanh dependence in diagnostics: large
  // lower-league production cannot create unlimited fantasy-price bonuses.
  return limit * (value / (1 + Math.abs(value)));
}

export function importEstimateV43(history: ImportHistory, pos: V43Position, currentTeam?: string): ImportEstimateV43 | null {
  const translation = LEAGUE_TRANSLATION_V43[history.league];
  if (translation == null) return null;

  const junior = /U18|U20|J20|NAHL|USHL/i.test(history.league);
  const prior = NEW_PLAYER_PRIOR_M[pos] + leaguePriorAdjustment(history.league, pos);
  const [lo, hi] = BOUNDS[pos];

  if (history.kind === "goalie") {
    if (pos !== "G" || history.games < 8 || !Number.isFinite(history.savePct) || !Number.isFinite(history.gaa)) return null;
    const w = sampleWeight(history.games, junior);
    const quality = ((history.savePct - 0.905) * 100 * 0.55) - ((history.gaa - 2.6) * 0.28);
    const delta = nonlinearDelta(quality, 4.0) * translation * w;
    const raw = clamp(prior + delta, lo, hi);
    const confidence = history.games >= 30 && translation >= 0.75 ? "Middels" : "Lav";
    return {
      raw,
      prior,
      weight: w,
      translation,
      confidence,
      metric: `${(history.savePct * 100).toFixed(1)} SV% · ${history.gaa.toFixed(2)} GAA`,
      note: junior ? "Junior/talentgrunnlag med sterk regresjon" : "Importmodell V4.3",
    };
  }

  if (pos === "G" || history.games < 10) return null;
  const ppg = history.points / history.games;
  const expected = pos === "D" ? 0.30 : 0.58;
  const scale = pos === "D" ? 5.0 : 5.8;
  const w = sampleWeight(history.games, junior);

  // Production bonus is intentionally capped and nonlinear. This is the main
  // correction for e.g. Ringerike/Norway2 players who were overpriced in V4.2.
  const productionSignal = (ppg - expected) * scale;
  let delta = nonlinearDelta(productionSignal, pos === "D" ? 3.0 : 4.0) * translation * w;

  // Promoted-club continuity is uncertainty, not a blanket club punishment:
  // only shrink the translated deviation when the same player moves with the
  // promoted Norway2 club into EHL. The prior itself is untouched.
  if (history.league === "Norway2" && currentTeam === "Ringerike") delta *= 0.72;

  const raw = clamp(prior + delta, lo, hi);
  const confidence = history.games >= 40 && translation >= 0.75 ? "Middels" : "Lav";
  return {
    raw,
    prior,
    weight: w,
    translation,
    confidence,
    metric: `${ppg.toFixed(2)} P/GP`,
    note: junior ? "Talentmodell V4.3" : "Importmodell V4.3",
  };
}

export type TalentHistoryV43 = {
  name: string;
  position: V43Position;
  league: "Norway U18" | "Norway U20" | "J20 Nationell";
  games: number;
  goals?: number;
  assists?: number;
  points?: number;
  savePct?: number;
  gaa?: number;
  sourceNote: string;
};

export const TALENT_HISTORY_2026_V43: TalentHistoryV43[] = [
  {
    name: "Victor Slettebråten Karadas",
    position: "D",
    league: "Norway U18",
    games: 42,
    goals: 25,
    assists: 25,
    points: 50,
    sourceNote: "Documented U18 production across 2023–26; only 3 Norway2 senior games in 2025/26.",
  },
  {
    name: "Matheo Werner Dubec",
    position: "W",
    league: "Norway U18",
    games: 5,
    goals: 6,
    assists: 2,
    points: 8,
    sourceNote: "2025/26 U18 playoff sample; one EHL appearance. Kept very low confidence.",
  },
  {
    name: "Sondre Berg",
    position: "D",
    league: "Norway U18",
    games: 2,
    goals: 0,
    assists: 0,
    points: 0,
    sourceNote: "Thin senior sample; U18 national-team context. Price should stay close to new-player prior.",
  },
];

export function talentEstimateV43(t: TalentHistoryV43): ImportEstimateV43 {
  const prior = NEW_PLAYER_PRIOR_M[t.position] - (t.position === "G" ? 0.5 : 0.75);
  const translation = LEAGUE_TRANSLATION_V43[t.league];
  const [lo, hi] = BOUNDS[t.position];
  const w = sampleWeight(t.games, true);

  if (t.position === "G" && Number.isFinite(t.savePct) && Number.isFinite(t.gaa)) {
    const quality = (((t.savePct as number) - 0.905) * 100 * 0.45) - (((t.gaa as number) - 2.6) * 0.2);
    return { raw: clamp(prior + nonlinearDelta(quality, 2.0) * translation * w, lo, hi), prior, weight: w, translation, confidence: "Lav", metric: `${((t.savePct as number) * 100).toFixed(1)} SV%`, note: "Talentmodell V4.3" };
  }

  const ppg = t.games > 0 ? Number(t.points || 0) / t.games : 0;
  const expected = t.position === "D" ? 0.45 : 0.75;
  const signal = (ppg - expected) * (t.position === "D" ? 2.5 : 3.0);
  const raw = clamp(prior + nonlinearDelta(signal, 1.8) * translation * w, lo, hi);
  return { raw, prior, weight: w, translation, confidence: "Lav", metric: `${ppg.toFixed(2)} P/GP junior`, note: "Talentmodell V4.3" };
}
