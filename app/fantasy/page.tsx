"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase";
import "./fantasy.css";

type Recommendation = {
  label: string;
  name: string;
  detail: string;
};

const recommendations: Recommendation[] = [
  { label: "🔥 Kjøp", name: "Ingen data ennå", detail: "Aktiveres når spiller- og kampdata er synkronisert." },
  { label: "👑 Kaptein", name: "Ingen data ennå", detail: "Rangeres etter forventede poeng i neste runde." },
  { label: "⚠️ Selg", name: "Ingen data ennå", detail: "Basert på form, pris, kampprogram og forventede poeng." },
];

export default function FantasyPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) { setAllowed(false); return; }
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) { setAllowed(false); return; }
      const { data: player } = await supabase.from("players").select("admin").eq("id", user.id).maybeSingle();
      setAllowed(Boolean(player?.admin));
    })();
  }, []);

  if (allowed === null) {
    return <main className="fantasy-shell"><p className="fantasy-lead">Sjekker admin-tilgang …</p></main>;
  }

  if (!allowed) {
    return (
      <main className="fantasy-shell">
        <section className="fantasy-card">
          <p className="eyebrow">ADMIN ONLY</p>
          <h1>Ingen tilgang</h1>
          <p className="card-copy">Fantasy Hockey er bare tilgjengelig for administratorer.</p>
          <a href="/" className="pill" style={{ textDecoration: "none", display: "inline-block", marginTop: 12 }}>← Tilbake til Stang Inn</a>
        </section>
      </main>
    );
  }

  return (
    <main className="fantasy-shell">
      <section className="fantasy-hero">
        <div>
          <p className="fantasy-kicker">STANG INN · ADMIN · FANTASY HOCKEY</p>
          <h1>Fantasy-sentralen</h1>
          <p className="fantasy-lead">
            Automatisk spillerstatistikk, 19Fantasy-poeng, form, kampprogram og anbefalte bytter – uten regneark.
          </p>
        </div>
        <div className="fantasy-status">
          <span className="status-dot" />
          Admin only
        </div>
      </section>

      <section className="fantasy-metrics">
        <article><span>Lagverdi</span><strong>—</strong><small>Kobles til ditt fantasy-lag</small></article>
        <article><span>Forventede poeng</span><strong>—</strong><small>Neste runde</small></article>
        <article><span>Formspiller</span><strong>—</strong><small>Siste 5 kamper</small></article>
        <article><span>Beste verdi</span><strong>—</strong><small>Poeng per million</small></article>
      </section>

      <section className="fantasy-grid">
        <div className="fantasy-card fantasy-main-card">
          <div className="card-heading"><div><p className="eyebrow">RUNDEANALYSE</p><h2>Anbefalinger</h2></div><span className="pill">Neste runde</span></div>
          <div className="recommendation-list">
            {recommendations.map((item) => (
              <div className="recommendation" key={item.label}>
                <span className="recommendation-label">{item.label}</span>
                <div><strong>{item.name}</strong><p>{item.detail}</p></div>
              </div>
            ))}
          </div>
        </div>

        <div className="fantasy-card">
          <p className="eyebrow">KOMMENDE KAMPER</p><h2>Fixture rating</h2>
          <div className="empty-state"><div className="fixture-dots" aria-hidden="true"><span>●</span><span>●</span><span>●</span><span>●</span><span>●</span></div><p>Terminlisten kobles til automatisk EHL-synk.</p></div>
        </div>

        <div className="fantasy-card">
          <p className="eyebrow">BYTTEVERKTØY</p><h2>Optimaliser laget</h2>
          <p className="card-copy">Velg budsjett og maks antall bytter. Motoren skal foreslå beste kombinasjon basert på forventede poeng og kampprogram.</p>
          <button type="button" disabled>Kommer i neste steg</button>
        </div>

        <div className="fantasy-card">
          <p className="eyebrow">SPILLERDATABASE</p><h2>Alle EHL-spillere</h2>
          <p className="card-copy">Pris, posisjon, poeng, P/kamp, form 3/5/10, verdi per million og kommende kamper samles her.</p>
          <div className="mini-table"><span>Spiller</span><span>Form</span><span>FP</span><strong>Avventer synk</strong><span>—</span><span>—</span></div>
        </div>
      </section>

      <section className="fantasy-card build-status">
        <div><p className="eyebrow">STATUS</p><h2>Første MVP</h2></div>
        <div className="status-steps"><span className="done">✓ Admin-låst</span><span className="done">✓ Datamodell</span><span className="done">✓ Dashboard</span><span>○ Spillersynk</span><span>○ Poengmotor</span><span>○ Anbefalingsmotor</span></div>
      </section>
    </main>
  );
}
