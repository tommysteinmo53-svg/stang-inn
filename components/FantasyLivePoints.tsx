"use client";
import { useEffect, useRef, useState } from "react";
import { fetchLivePoints } from "../lib/live-client";
import type { LivePoints } from "../lib/fantasy/live-service";
import { useVisibleRefresh } from "../lib/hooks/use-visible-refresh";
import styles from "./FantasyLivePoints.module.css";

export default function FantasyLivePoints() {
  const [data, setData] = useState<LivePoints | null>(null), [error, setError] = useState("");
  const pending = useRef(false), mounted = useRef(false);
  async function refresh() {
    if (pending.current) return;
    pending.current = true;
    try { const next = await fetchLivePoints(); if (mounted.current) { setData(next); setError(""); } }
    catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : "Kunne ikke hente live-poeng."); }
    finally { pending.current = false; }
  }
  useEffect(() => { mounted.current = true; void refresh(); return () => { mounted.current = false; }; }, []);
  useVisibleRefresh(refresh);
  const stale = data && Date.now() - new Date(data.checkedAt).getTime() > 120000;
  return <section className={styles.panel} aria-label="Foreløpige fantasy-poeng">
    <div className={styles.heading}><h2>Fantasy · live-poeng</h2><span>Oppdateres hvert 30. sekund</span></div>
    {error && <p role="status" className={styles.warning}>{error}{data ? " Viser siste hentede tall." : ""}</p>}
    {stale && <p className={styles.warning}>Tallene er over to minutter gamle. Kilden kan være forsinket.</p>}
    {data && <p className={styles.note}>Sist hentet {new Date(data.checkedAt).toLocaleTimeString("nb-NO", { timeZone: "Europe/Oslo", hour: "2-digit", minute: "2-digit", second: "2-digit" })} · HockeyLive</p>}
    {!data && !error && <p>Henter live-poeng …</p>}
    {data?.rounds.length === 0 && <p>Ingen pågående fantasyrunde. Bekreftede poeng vises i sesongtabellen.</p>}
    {data?.rounds.map(round => <div key={round.roundNo}>
      <h3>Runde {round.roundNo} · foreløpig</h3>
      <p className={styles.note}>Poeng fra ferdigimporterte kamper og tilgjengelig live-statistikk. Keeperseier og shutout legges til etter kampslutt. Kilden kan være forsinket.</p>
      {!round.complete && <p className={styles.warning}>Noe kampstatistikk mangler. Tall med * er delsummer og kan ikke sammenlignes som en fullstendig stilling.</p>}
      <div className={styles.table}><table><thead><tr><th>Fantasylag</th><th>Foreløpige rundepoeng</th></tr></thead><tbody>{round.teams.map(team => <tr key={team.teamId}><td>{team.name}</td><td>{team.points.toLocaleString("nb-NO", { maximumFractionDigits: 2 })}{team.missing ? " *" : ""}</td></tr>)}</tbody></table></div>
      {!round.teams.length && <p>Venter på låste lag for denne runden.</p>}
    </div>)}
  </section>;
}
