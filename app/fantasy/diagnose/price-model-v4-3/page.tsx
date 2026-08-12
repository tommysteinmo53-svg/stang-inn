"use client";

import { useMemo, useState } from "react";
import { importHistoryFor, leagueStrength } from "../../../../lib/fantasy/import-history-2026";
import {
  importEstimateV43,
  talentEstimateV43,
  TALENT_HISTORY_2026_V43,
  type TalentHistoryV43,
  type V43Position,
} from "../../../../lib/fantasy/import-pricing-v4-3";
import { clamp } from "../../../../lib/fantasy/market-calibration";
import "../../fantasy.css";

const POS = new Set(["C", "W", "D", "G"]);
const V42_ANCHOR: Record<V43Position, number> = { C: 10, W: 8.5, D: 5, G: 9.5 };
const V42_BOUNDS: Record<V43Position, [number, number]> = { C: [5, 18], W: [4, 18], D: [3, 14], G: [5, 17] };

const EXTRA_TALENTS: TalentHistoryV43[] = [
  {
    name: "Markus Walberg",
    position: "G",
    league: "Norway U20",
    games: 33,
    savePct: 0.916,
    gaa: 3.0,
    sourceNote: "Sparta U20 2025/26: 33 GP, .916 SV%, 3.00 GAA; promoted to A-team goalie duo for 2026/27.",
  },
];

function norm(v: unknown) {
  return String(v ?? "").toLocaleLowerCase("nb-NO").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ø/g, "o").replace(/æ/g, "ae").replace(/[^a-z0-9]+/g, " ").trim();
}

function canonTeam(v: unknown) {
  const s = norm(v);
  if (s.includes("storhamar")) return "Storhamar";
  if (s.includes("stavanger") || s.includes("oilers")) return "Stavanger";
  if (s.includes("valerenga")) return "Vålerenga";
  if (s.includes("frisk")) return "Frisk Asker";
  if (s.includes("sparta")) return "Sparta";
  if (s.includes("narvik")) return "Narvik";
  if (s.includes("stjernen")) return "Stjernen";
  if (s.includes("lillehammer")) return "Lillehammer";
  if (s.includes("ringerike")) return "Ringerike";
  if (s.includes("nidaros")) return "Nidaros";
  return String(v ?? "");
}

function oldV42(history: any, pos: V43Position) {
  const anchor = V42_ANCHOR[pos];
  const strength = leagueStrength(history.league);
  if (strength == null) return null;
  const bounds = V42_BOUNDS[pos];
  if (history.kind === "goalie") {
    if (pos !== "G" || history.games < 10) return null;
    const w = clamp(history.games / 35, 0.25, 0.85);
    const saveAdj = (history.savePct - 0.905) * 100 * 0.42;
    const gaaAdj = -(history.gaa - 2.6) * 0.35;
    return clamp(anchor + (saveAdj + gaaAdj) * strength * w, bounds[0], bounds[1]);
  }
  if (pos === "G" || history.games < 15) return null;
  const ppg = history.points / history.games;
  const expected = pos === "D" ? 0.28 : 0.55;
  const scale = pos === "D" ? 7 : 8;
  const w = clamp(history.games / 40, 0.30, 0.90);
  return clamp(anchor + (ppg - expected) * scale * strength * w, bounds[0], bounds[1]);
}

function half(v: number) { return Math.round(v * 2) / 2; }
function avg(xs: number[]) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }

export default function Page() {
  const [rows, setRows] = useState<any[]>([]);
  const [msg, setMsg] = useState("Klar for V4.3-prisanalyse");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const res = await fetch("/api/fantasy-roster-enriched-2026", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok || !Array.isArray(data.rows)) throw new Error(data.error || "Kunne ikke hente 2026/27-roster");
      const talents = new Map([...TALENT_HISTORY_2026_V43, ...EXTRA_TALENTS].map(t => [norm(t.name), t]));
      const out: any[] = [];
      for (const r of data.rows) {
        const posRaw = String(r.position || "").toUpperCase();
        if (!POS.has(posRaw)) continue;
        const pos = posRaw as V43Position;
        const team = canonTeam(r.team);
        const ih = importHistoryFor(String(r.name));
        const talent = talents.get(norm(r.name));
        if (ih) {
          const v43 = importEstimateV43(ih, pos, team);
          const v42 = oldV42(ih, pos);
          if (v43) out.push({ name: r.name, team, pos, cls: v43.note, league: ih.league, games: ih.games, metric: v43.metric, v42: v42 == null ? null : half(v42), v43: half(v43.raw), delta: v42 == null ? null : half(v43.raw) - half(v42), prior: v43.prior, translation: v43.translation, confidence: v43.confidence });
        } else if (talent) {
          const v43 = talentEstimateV43(talent);
          out.push({ name: r.name, team, pos, cls: "Talentmodell V4.3", league: talent.league, games: talent.games, metric: v43.metric, v42: null, v43: half(v43.raw), delta: null, prior: v43.prior, translation: v43.translation, confidence: v43.confidence });
        }
      }
      out.sort((a, b) => a.team.localeCompare(b.team, "nb") || a.name.localeCompare(b.name, "nb"));
      setRows(out);
      setMsg(`Ferdig · ${out.length} import-/talentpriser analysert`);
    } catch (e: any) {
      setMsg(`Feil: ${e.message || e}`);
    } finally { setBusy(false); }
  }

  const teams = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const r of rows) map.set(r.team, [...(map.get(r.team) || []), r]);
    return [...map.entries()].map(([team, rs]) => ({ team, count: rs.length, v42: avg(rs.map(x => x.v42).filter(Number.isFinite)), v43: avg(rs.map(x => x.v43).filter(Number.isFinite)), change: avg(rs.map(x => x.delta).filter(Number.isFinite)) })).sort((a, b) => b.v43 - a.v43);
  }, [rows]);

  const ringerike = rows.filter(r => r.team === "Ringerike");

  return <main className="fantasy-page">
    <section className="fantasy-card">
      <h1>Pris-modell V4.3 · import- og talentanalyse</h1>
      <p>Dette er en kandidatmodell, ikke produksjonspriser. V4.3 skiller startprior fra ligatranslasjon, bruker sterkere regresjon for Norway2/junior og kapper produksjonsbonusen ikke-lineært.</p>
      <button onClick={run} disabled={busy}>{busy ? "Analyserer…" : "Kjør V4.3-analyse"}</button>
      <p><strong>{msg}</strong></p>
    </section>

    {rows.length > 0 && <>
      <section className="fantasy-card">
        <h2>Klubbkontroll</h2>
        <table><thead><tr><th>Lag</th><th>Spillere</th><th>V4.2 snitt</th><th>V4.3 snitt</th><th>Snittendring</th></tr></thead><tbody>
          {teams.map(t => <tr key={t.team}><td>{t.team}</td><td>{t.count}</td><td>{t.v42 ? `${t.v42.toFixed(2)}m` : "—"}</td><td>{t.v43.toFixed(2)}m</td><td>{Number.isFinite(t.change) ? `${t.change > 0 ? "+" : ""}${t.change.toFixed(2)}m` : "—"}</td></tr>)}
        </tbody></table>
      </section>

      <section className="fantasy-card">
        <h2>Ringerike-audit</h2>
        <p>Promoterte Norway2-spillere får ikke et flatt klubbtrekk. Bare avviket fra nyspillerprioren krympes ekstra fordi samme produksjonsnivå skal oversettes til EHL med høy usikkerhet.</p>
        <table><thead><tr><th>Spiller</th><th>Pos</th><th>Liga</th><th>Metric</th><th>V4.2</th><th>V4.3</th><th>Δ</th></tr></thead><tbody>
          {ringerike.map(r => <tr key={r.name}><td>{r.name}</td><td>{r.pos}</td><td>{r.league}</td><td>{r.metric}</td><td>{r.v42 == null ? "—" : `${r.v42.toFixed(1)}m`}</td><td><strong>{r.v43.toFixed(1)}m</strong></td><td>{r.delta == null ? "—" : `${r.delta > 0 ? "+" : ""}${r.delta.toFixed(1)}m`}</td></tr>)}
        </tbody></table>
      </section>

      <section className="fantasy-card">
        <h2>Alle import-/talentkandidater</h2>
        <table><thead><tr><th>Spiller</th><th>Lag</th><th>Pos</th><th>Klasse</th><th>Liga</th><th>K</th><th>Metric</th><th>V4.2</th><th>V4.3</th><th>Trans.</th><th>Tillit</th></tr></thead><tbody>
          {rows.map(r => <tr key={`${r.team}-${r.name}`}><td>{r.name}</td><td>{r.team}</td><td>{r.pos}</td><td>{r.cls}</td><td>{r.league}</td><td>{r.games}</td><td>{r.metric}</td><td>{r.v42 == null ? "—" : `${r.v42.toFixed(1)}m`}</td><td><strong>{r.v43.toFixed(1)}m</strong></td><td>{r.translation.toFixed(2)}</td><td>{r.confidence}</td></tr>)}
        </tbody></table>
      </section>
    </>}
  </main>;
}
