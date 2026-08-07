const players = [
  { name: "Tommy", points: 128, exact: 14, trend: "+8" },
  { name: "Katarina", points: 123, exact: 12, trend: "+5" },
  { name: "Spiller 3", points: 117, exact: 11, trend: "+3" },
  { name: "Spiller 4", points: 109, exact: 9, trend: "+2" },
];

const upcoming = [
  { home: "Narvik", away: "Storhamar", time: "Fre 19:00", delivered: 3 },
  { home: "Vålerenga", away: "Oilers", time: "Lør 16:00", delivered: 2 },
  { home: "Frisk Asker", away: "Sparta", time: "Lør 18:30", delivered: 4 },
];

export default function Home() {
  return (
    <main className="appShell">
      <header className="topbar">
        <div className="brand">
          <div className="brandMark">🏒</div>
          <div>
            <p className="eyebrow">EHL 2026/27</p>
            <h1>Stang Inn</h1>
          </div>
        </div>
        <div className="avatar">T</div>
      </header>

      <nav className="navTabs" aria-label="Hovedmeny">
        <button className="active">Oversikt</button>
        <button>Kamper</button>
        <button>Tabelltips</button>
        <button>Statistikk</button>
        <button>Awards</button>
      </nav>

      <section className="heroCard">
        <div>
          <p className="eyebrow">Neste kamp</p>
          <h2>Narvik <span>vs</span> Storhamar</h2>
          <p className="muted">Fredag kl. 19:00 · tips låses ved kampstart</p>
        </div>
        <div className="countdown">
          <strong>2d 07t</strong>
          <span>til kampstart</span>
        </div>
      </section>

      <section className="statsGrid">
        <article className="miniCard">
          <span>🏆 Månedsvinner</span>
          <strong>Katarina</strong>
          <small>34 poeng i oktober</small>
        </article>
        <article className="miniCard">
          <span>🔥 Hot streak</span>
          <strong>Tommy</strong>
          <small>6 riktige på rad</small>
        </article>
        <article className="miniCard">
          <span>🤣 Ukens bom</span>
          <strong>Spiller 4</strong>
          <small>Tippet 6–1 · ble 1–3</small>
        </article>
        <article className="miniCard">
          <span>👑 Eksperten</span>
          <strong>Tommy</strong>
          <small>Leder sammenlagt</small>
        </article>
      </section>

      <section className="contentGrid">
        <article className="panel standings">
          <div className="panelHeading">
            <div>
              <p className="eyebrow">Sesongen</p>
              <h3>Sammenlagt</h3>
            </div>
            <button className="textButton">Se statistikk →</button>
          </div>
          <div className="tableHead">
            <span>#</span><span>Spiller</span><span>Eksakte</span><span>Poeng</span>
          </div>
          {players.map((p, i) => (
            <div className="tableRow" key={p.name}>
              <span className="rank">{i + 1}</span>
              <span><b>{p.name}</b><small>{p.trend} siste runde</small></span>
              <span>{p.exact}</span>
              <span className="points">{p.points}</span>
            </div>
          ))}
        </article>

        <article className="panel upcoming">
          <div className="panelHeading">
            <div>
              <p className="eyebrow">Neste runde</p>
              <h3>Kamper</h3>
            </div>
            <button className="textButton">Alle kamper →</button>
          </div>
          <div className="matchStack">
            {upcoming.map((m) => (
              <div className="matchCard" key={`${m.home}-${m.away}`}>
                <div>
                  <small>{m.time}</small>
                  <strong>{m.home} – {m.away}</strong>
                </div>
                <span className={m.delivered === 4 ? "delivery complete" : "delivery"}>{m.delivered}/4 levert</span>
              </div>
            ))}
          </div>
          <button className="primaryButton">Lever tips</button>
        </article>
      </section>

      <section className="quoteCard">
        <span>💬 Pucken sier</span>
        <p>«Tre av fire har levert tips. Noen liker tydeligvis å leve farlig.»</p>
      </section>

      <footer className="footer">Stang Inn · prototype v0.1</footer>
    </main>
  );
}
