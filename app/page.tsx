"use client";

import { useState } from "react";

type Tab = "overview" | "matches" | "tabletips" | "stats" | "awards" | "profile";

const players = [
  { name: "Tommy", points: 128, exact: 14, trend: "+8", form: "🔥🔥🔥🔥" },
  { name: "Katarina", points: 123, exact: 12, trend: "+5", form: "🔥🔥🔥" },
  { name: "Spiller 3", points: 117, exact: 11, trend: "+3", form: "🔥🔥" },
  { name: "Spiller 4", points: 109, exact: 9, trend: "+2", form: "🔥" },
];

const upcoming = [
  { home: "Narvik", away: "Storhamar", time: "Fre 19:00", delivered: 3 },
  { home: "Vålerenga", away: "Oilers", time: "Lør 16:00", delivered: 2 },
  { home: "Frisk Asker", away: "Sparta", time: "Lør 18:30", delivered: 4 },
  { home: "Lillehammer", away: "Nidaros", time: "Søn 17:00", delivered: 1 },
];

const tablePrediction = [
  "Storhamar", "Oilers", "Vålerenga", "Frisk Asker", "Sparta",
  "Narvik", "Stjernen", "Lillehammer", "Nidaros", "Ringerike",
];

const awards = [
  { icon: "🏆", title: "Månedsvinner", name: "Katarina", detail: "34 poeng i oktober" },
  { icon: "🔥", title: "Hot streak", name: "Tommy", detail: "6 riktige på rad" },
  { icon: "🤣", title: "Ukens bom", name: "Spiller 4", detail: "Tippet 6–1 · ble 1–3" },
  { icon: "🎯", title: "Sniper", name: "Tommy", detail: "14 eksakte resultater" },
  { icon: "🧊", title: "Iskald", name: "Spiller 4", detail: "2 poeng siste 5 kamper" },
  { icon: "👑", title: "Eksperten", name: "Tommy", detail: "Leder sammenlagt" },
];

function Header({ tab, setTab }: { tab: Tab; setTab: (tab: Tab) => void }) {
  const nav: { key: Tab; label: string }[] = [
    { key: "overview", label: "Oversikt" },
    { key: "matches", label: "Kamper" },
    { key: "tabletips", label: "Tabelltips" },
    { key: "stats", label: "Statistikk" },
    { key: "awards", label: "Awards" },
    { key: "profile", label: "Profil" },
  ];

  return (
    <>
      <header className="topbar">
        <button className="brand brandButton" onClick={() => setTab("overview")} aria-label="Gå til oversikten">
          <div className="brandMark">🏒</div>
          <div>
            <p className="eyebrow">EHL 2026/27</p>
            <h1>Stang Inn</h1>
          </div>
        </button>
        <button className="avatar avatarButton" onClick={() => setTab("profile")} aria-label="Åpne profil">T</button>
      </header>
      <nav className="navTabs" aria-label="Hovedmeny">
        {nav.map((item) => (
          <button key={item.key} className={tab === item.key ? "active" : ""} onClick={() => setTab(item.key)}>
            {item.label}
          </button>
        ))}
      </nav>
    </>
  );
}

function Overview({ setTab }: { setTab: (tab: Tab) => void }) {
  return (
    <>
      <section className="heroCard">
        <div>
          <p className="eyebrow">Neste kamp</p>
          <h2>Narvik <span>vs</span> Storhamar</h2>
          <p className="muted">Fredag kl. 19:00 · tips låses ved kampstart</p>
        </div>
        <div className="countdown"><strong>2d 07t</strong><span>til kampstart</span></div>
      </section>

      <section className="statsGrid">
        {awards.slice(0, 4).map((a) => (
          <article className="miniCard" key={a.title}><span>{a.icon} {a.title}</span><strong>{a.name}</strong><small>{a.detail}</small></article>
        ))}
      </section>

      <section className="contentGrid">
        <article className="panel standings">
          <div className="panelHeading"><div><p className="eyebrow">Sesongen</p><h3>Sammenlagt</h3></div><button className="textButton" onClick={() => setTab("stats")}>Se statistikk →</button></div>
          <div className="tableHead"><span>#</span><span>Spiller</span><span>Eksakte</span><span>Poeng</span></div>
          {players.map((p, i) => <div className="tableRow" key={p.name}><span className="rank">{i + 1}</span><span><b>{p.name}</b><small>{p.trend} siste runde</small></span><span>{p.exact}</span><span className="points">{p.points}</span></div>)}
        </article>
        <article className="panel upcoming">
          <div className="panelHeading"><div><p className="eyebrow">Neste runde</p><h3>Kamper</h3></div><button className="textButton" onClick={() => setTab("matches")}>Alle kamper →</button></div>
          <div className="matchStack">{upcoming.slice(0, 3).map((m) => <div className="matchCard" key={`${m.home}-${m.away}`}><div><small>{m.time}</small><strong>{m.home} – {m.away}</strong></div><span className={m.delivered === 4 ? "delivery complete" : "delivery"}>{m.delivered}/4 levert</span></div>)}</div>
          <button className="primaryButton" onClick={() => setTab("matches")}>Lever tips</button>
        </article>
      </section>
      <section className="quoteCard"><span>💬 Pucken sier</span><p>«Tre av fire har levert tips. Noen liker tydeligvis å leve farlig.»</p></section>
    </>
  );
}

function Matches() {
  return <section className="pageStack">
    <div className="pageHeading"><div><p className="eyebrow">Runde 1</p><h2>Kamper & tips</h2><p className="muted">Prototype: feltene kobles til Supabase i v0.2/v0.3.</p></div><span className="statusPill">4 kamper</span></div>
    {upcoming.map((m, i) => <article className="panel matchDetail" key={`${m.home}-${m.away}`}>
      <div><small className="muted">{m.time}</small><h3>{m.home} <span className="versus">–</span> {m.away}</h3><span className={m.delivered === 4 ? "delivery complete" : "delivery"}>{m.delivered}/4 tips levert</span></div>
      <div className="tipControls"><label><span>H</span><input type="number" min="0" defaultValue={i % 2 === 0 ? 3 : 2}/></label><strong>–</strong><label><span>B</span><input type="number" min="0" defaultValue={i % 2 === 0 ? 2 : 3}/></label><button className="compactButton">Lagre tips</button></div>
    </article>)}
  </section>;
}

function TableTips() {
  return <section className="contentGrid">
    <article className="panel"><div className="panelHeading"><div><p className="eyebrow">Mitt tips</p><h2>Tabelltips</h2></div><span className="statusPill">Ikke låst</span></div><p className="muted sectionIntro">Ranger lagene før sesongstart. Senere beregner appen avviket mot den faktiske EHL-tabellen.</p>
      <div className="rankingList">{tablePrediction.map((team, i) => <div className="rankingItem" key={team}><span className="rank">{i + 1}</span><strong>{team}</strong><div className="rankingButtons"><button disabled={i === 0}>↑</button><button disabled={i === tablePrediction.length - 1}>↓</button></div></div>)}</div><button className="primaryButton">Lagre tabelltips</button>
    </article>
    <article className="panel"><p className="eyebrow">Konkurransen</p><h3>Tabelltips-stilling</h3><div className="simpleList"><div><span>1. Tommy</span><strong>12 avvik</strong></div><div><span>2. Katarina</span><strong>16 avvik</strong></div><div><span>3. Spiller 3</span><strong>21 avvik</strong></div><div><span>4. Spiller 4</span><strong>27 avvik</strong></div></div></article>
  </section>;
}

function Stats() {
  return <section className="pageStack"><div className="pageHeading"><div><p className="eyebrow">Sesongdata</p><h2>Statistikk</h2></div></div>
    <section className="statsGrid">{players.map((p) => <article className="miniCard" key={p.name}><span>{p.form} Form</span><strong>{p.name}</strong><small>{p.exact} eksakte · {p.points} poeng</small></article>)}</section>
    <section className="contentGrid"><article className="panel"><p className="eyebrow">Poengutvikling</p><h3>Sesonggraf</h3><div className="fakeChart"><div className="chartLine line1"/><div className="chartLine line2"/><div className="chartLine line3"/><div className="chartLine line4"/><span>Grafen kobles til ekte kampdata i neste sprint.</span></div></article><article className="panel"><p className="eyebrow">Head-to-head</p><h3>Tommy vs Katarina</h3><div className="versusCard"><div><strong>18</strong><span>Tommy</span></div><b>VS</b><div><strong>15</strong><span>Katarina</span></div></div><p className="muted">3 uavgjorte kampdueller</p></article></section>
  </section>;
}

function Awards() {
  return <section className="pageStack"><div className="pageHeading"><div><p className="eyebrow">Moro & rivalisering</p><h2>Awards</h2></div></div><div className="awardGrid">{awards.map((a) => <article className="awardCard" key={a.title}><div className="awardIcon">{a.icon}</div><span>{a.title}</span><strong>{a.name}</strong><small>{a.detail}</small></article>)}</div><article className="panel"><p className="eyebrow">Hall of fame</p><h3>Troféskap</h3><div className="trophyShelf"><span>🏆 Oktober · Katarina</span><span>🎯 Flest eksakte · Tommy</span><span>🔥 Lengste streak · Tommy</span></div></article></section>;
}

function Profile() {
  return <section className="pageStack"><article className="profileHero"><div className="profileAvatar">T</div><div><p className="eyebrow">Min profil</p><h2>Tommy</h2><p className="muted">Stang Inn-medlem · 2026/27</p></div></article><section className="statsGrid"><article className="miniCard"><span>Poeng</span><strong>128</strong><small>1. plass</small></article><article className="miniCard"><span>Eksakte</span><strong>14</strong><small>Sesongen</small></article><article className="miniCard"><span>Beste streak</span><strong>6</strong><small>Kamper på rad</small></article><article className="miniCard"><span>Titler</span><strong>3</strong><small>Achievements</small></article></section><article className="panel"><p className="eyebrow">Mine merker</p><h3>Achievements</h3><div className="badgeRow"><span>👑 Eksperten</span><span>🎯 Sniper</span><span>🔥 Hot Hand</span></div></article></section>;
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("overview");
  return <main className="appShell"><Header tab={tab} setTab={setTab}/>{tab === "overview" && <Overview setTab={setTab}/>} {tab === "matches" && <Matches/>} {tab === "tabletips" && <TableTips/>} {tab === "stats" && <Stats/>} {tab === "awards" && <Awards/>} {tab === "profile" && <Profile/>}<footer className="footer">Stang Inn · prototype v0.1</footer></main>;
}
