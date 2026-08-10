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
  return (
    <main className="fantasy-shell">
      <section className="fantasy-hero">
        <div>
          <p className="fantasy-kicker">STANG INN · FANTASY HOCKEY</p>
          <h1>Fantasy-sentralen</h1>
          <p className="fantasy-lead">
            Automatisk spillerstatistikk, 19Fantasy-poeng, form, kampprogram og anbefalte bytter – uten regneark.
          </p>
        </div>
        <div className="fantasy-status">
          <span className="status-dot" />
          MVP bygges nå
        </div>
      </section>

      <section className="fantasy-metrics">
        <article>
          <span>Lagverdi</span>
          <strong>—</strong>
          <small>Kobles til ditt fantasy-lag</small>
        </article>
        <article>
          <span>Forventede poeng</span>
          <strong>—</strong>
          <small>Neste runde</small>
        </article>
        <article>
          <span>Formspiller</span>
          <strong>—</strong>
          <small>Siste 5 kamper</small>
        </article>
        <article>
          <span>Beste verdi</span>
          <strong>—</strong>
          <small>Poeng per million</small>
        </article>
      </section>

      <section className="fantasy-grid">
        <div className="fantasy-card fantasy-main-card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">RUNDEANALYSE</p>
              <h2>Anbefalinger</h2>
            </div>
            <span className="pill">Neste runde</span>
          </div>

          <div className="recommendation-list">
            {recommendations.map((item) => (
              <div className="recommendation" key={item.label}>
                <span className="recommendation-label">{item.label}</span>
                <div>
                  <strong>{item.name}</strong>
                  <p>{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="fantasy-card">
          <p className="eyebrow">KOMMENDE KAMPER</p>
          <h2>Fixture rating</h2>
          <div className="empty-state">
            <div className="fixture-dots" aria-hidden="true">
              <span>●</span><span>●</span><span>●</span><span>●</span><span>●</span>
            </div>
            <p>Terminlisten kobles til automatisk EHL-synk.</p>
          </div>
        </div>

        <div className="fantasy-card">
          <p className="eyebrow">BYTTEVERKTØY</p>
          <h2>Optimaliser laget</h2>
          <p className="card-copy">
            Velg budsjett og maks antall bytter. Motoren skal foreslå beste kombinasjon basert på forventede poeng og kampprogram.
          </p>
          <button type="button" disabled>Kommer i neste steg</button>
        </div>

        <div className="fantasy-card">
          <p className="eyebrow">SPILLERDATABASE</p>
          <h2>Alle EHL-spillere</h2>
          <p className="card-copy">
            Pris, posisjon, poeng, P/kamp, form 3/5/10, verdi per million og kommende kamper samles her.
          </p>
          <div className="mini-table">
            <span>Spiller</span><span>Form</span><span>FP</span>
            <strong>Avventer synk</strong><span>—</span><span>—</span>
          </div>
        </div>
      </section>

      <section className="fantasy-card build-status">
        <div>
          <p className="eyebrow">STATUS</p>
          <h2>Første MVP</h2>
        </div>
        <div className="status-steps">
          <span className="done">✓ Datamodell</span>
          <span className="done">✓ Dashboard</span>
          <span>○ Spillersynk</span>
          <span>○ Poengmotor</span>
          <span>○ Anbefalingsmotor</span>
        </div>
      </section>
    </main>
  );
}
