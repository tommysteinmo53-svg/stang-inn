"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "../lib/supabase";

type Tab = "overview" | "matches" | "tabletips" | "stats" | "awards" | "profile";
type Player = { id: string; display_name: string; email: string | null; admin: boolean };
type Match = { id: number; home_team: string; away_team: string; match_time: string | null; home_score: number | null; away_score: number | null; finished: boolean; round: number | null };
type Tip = { id?: number; player_id: string; match_id: number; home_tip: number; away_tip: number };

type Standing = Player & { points: number; exact: number; correct: number };

const demoPlayers: Player[] = [
  { id: "demo-1", display_name: "Tommy", email: null, admin: true },
  { id: "demo-2", display_name: "Katarina", email: null, admin: false },
  { id: "demo-3", display_name: "Spiller 3", email: null, admin: false },
  { id: "demo-4", display_name: "Spiller 4", email: null, admin: false },
];

const tablePrediction = ["Storhamar", "Oilers", "Vålerenga", "Frisk Asker", "Sparta", "Narvik", "Stjernen", "Lillehammer", "Nidaros", "Ringerike"];

function outcome(h: number, a: number) { return h > a ? "H" : h < a ? "A" : "D"; }
function tipPoints(m: Match, t?: Tip) {
  if (!t || m.home_score === null || m.away_score === null) return 0;
  if (t.home_tip === m.home_score && t.away_tip === m.away_score) return 5;
  if (outcome(t.home_tip, t.away_tip) === outcome(m.home_score, m.away_score)) return 3;
  return 0;
}
function formatDate(value: string | null) {
  if (!value) return "Tidspunkt ikke satt";
  return new Date(value).toLocaleString("no-NO", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function Header({ tab, setTab, initial }: { tab: Tab; setTab: (tab: Tab) => void; initial: string }) {
  const nav: { key: Tab; label: string }[] = [
    { key: "overview", label: "Oversikt" }, { key: "matches", label: "Kamper" }, { key: "tabletips", label: "Tabelltips" },
    { key: "stats", label: "Statistikk" }, { key: "awards", label: "Awards" }, { key: "profile", label: "Profil" },
  ];
  return <><header className="topbar"><button className="brand brandButton" onClick={() => setTab("overview")}><div className="brandMark">🏒</div><div><p className="eyebrow">EHL 2026/27</p><h1>Stang Inn</h1></div></button><button className="avatar avatarButton" onClick={() => setTab("profile")}>{initial}</button></header><nav className="navTabs">{nav.map(item => <button key={item.key} className={tab === item.key ? "active" : ""} onClick={() => setTab(item.key)}>{item.label}</button>)}</nav></>;
}

function TipEditor({ match, existing, playerId, onSaved }: { match: Match; existing?: Tip; playerId: string; onSaved: () => Promise<void> }) {
  const [home, setHome] = useState(existing?.home_tip ?? 0);
  const [away, setAway] = useState(existing?.away_tip ?? 0);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setHome(existing?.home_tip ?? 0); setAway(existing?.away_tip ?? 0); }, [existing?.home_tip, existing?.away_tip]);
  const locked = match.finished || (!!match.match_time && new Date() >= new Date(match.match_time));

  async function save() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || locked) return;
    setSaving(true);
    const { error } = await supabase.from("tips").upsert({ player_id: playerId, match_id: match.id, home_tip: home, away_tip: away }, { onConflict: "player_id,match_id" });
    setSaving(false);
    if (error) alert(error.message); else await onSaved();
  }

  return <div className="tipControls"><label><span>H</span><input type="number" min="0" disabled={locked} value={home} onChange={e => setHome(Math.max(0, Number(e.target.value)))} /></label><strong>–</strong><label><span>B</span><input type="number" min="0" disabled={locked} value={away} onChange={e => setAway(Math.max(0, Number(e.target.value)))} /></label><button className="compactButton" disabled={locked || saving} onClick={save}>{locked ? "Låst" : saving ? "Lagrer …" : existing ? "Oppdater" : "Lagre tips"}</button></div>;
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("overview");
  const [players, setPlayers] = useState<Player[]>(demoPlayers);
  const [matches, setMatches] = useState<Match[]>([]);
  const [tips, setTips] = useState<Tip[]>([]);
  const [me, setMe] = useState<Player | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  async function load() {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    const supabase = getSupabaseBrowserClient(); if (!supabase) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user.id;
    const [p, m, t] = await Promise.all([
      supabase.from("players").select("id,display_name,email,admin").order("created_at"),
      supabase.from("matches").select("id,home_team,away_team,match_time,home_score,away_score,finished,round").order("match_time"),
      supabase.from("tips").select("id,player_id,match_id,home_tip,away_tip"),
    ]);
    if (p.data) { setPlayers(p.data as Player[]); setMe((p.data as Player[]).find(x => x.id === uid) ?? null); }
    if (m.data) setMatches(m.data as Match[]);
    if (t.data) setTips(t.data as Tip[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const standings = useMemo<Standing[]>(() => players.map(player => {
    let points = 0, exact = 0, correct = 0;
    matches.filter(m => m.finished || (m.home_score !== null && m.away_score !== null)).forEach(m => {
      const tip = tips.find(t => t.player_id === player.id && t.match_id === m.id);
      const pts = tipPoints(m, tip); points += pts; if (pts === 5) exact++; if (pts > 0) correct++;
    });
    return { ...player, points, exact, correct };
  }).sort((a, b) => b.points - a.points || b.exact - a.exact), [players, matches, tips]);

  const nextMatch = useMemo(() => matches.find(m => !m.finished && (!m.match_time || new Date(m.match_time) > new Date())), [matches]);
  const ownTips = useMemo(() => tips.filter(t => t.player_id === me?.id), [tips, me]);
  const initials = (me?.display_name || "T").slice(0, 1).toUpperCase();

  if (loading) return <main className="appShell"><p className="muted">Laster ligaen …</p></main>;

  return <main className="appShell">
    <Header tab={tab} setTab={setTab} initial={initials} />

    {tab === "overview" && <>
      <section className="heroCard"><div><p className="eyebrow">Neste kamp</p><h2>{nextMatch ? <>{nextMatch.home_team} <span>vs</span> {nextMatch.away_team}</> : "Terminlisten kommer snart"}</h2><p className="muted">{nextMatch ? `${formatDate(nextMatch.match_time)} · tips låses ved kampstart` : "EHL-synk er neste steg"}</p></div><div className="countdown"><strong>{matches.length}</strong><span>kamper i databasen</span></div></section>
      <section className="statsGrid"><article className="miniCard"><span>👑 Leder</span><strong>{standings[0]?.display_name || "–"}</strong><small>{standings[0]?.points ?? 0} poeng</small></article><article className="miniCard"><span>🎯 Sniper</span><strong>{[...standings].sort((a,b)=>b.exact-a.exact)[0]?.display_name || "–"}</strong><small>{[...standings].sort((a,b)=>b.exact-a.exact)[0]?.exact ?? 0} eksakte</small></article><article className="miniCard"><span>🏒 Kamper</span><strong>{matches.length}</strong><small>{matches.filter(m=>m.finished).length} ferdigspilt</small></article><article className="miniCard"><span>✅ Mine tips</span><strong>{ownTips.length}</strong><small>lagret i Supabase</small></article></section>
      <section className="contentGrid"><article className="panel standings"><div className="panelHeading"><div><p className="eyebrow">Sesongen</p><h3>Sammenlagt</h3></div><button className="textButton" onClick={()=>setTab("stats")}>Se statistikk →</button></div><div className="tableHead"><span>#</span><span>Spiller</span><span>Eksakte</span><span>Poeng</span></div>{standings.map((p,i)=><div className="tableRow" key={p.id}><span className="rank">{i+1}</span><span><b>{p.display_name}</b><small>{p.correct} poenggivende tips</small></span><span>{p.exact}</span><span className="points">{p.points}</span></div>)}</article><article className="panel upcoming"><div className="panelHeading"><div><p className="eyebrow">Neste</p><h3>Kamper</h3></div><button className="textButton" onClick={()=>setTab("matches")}>Alle kamper →</button></div><div className="matchStack">{matches.filter(m=>!m.finished).slice(0,3).map(m=><div className="matchCard" key={m.id}><div><small>{formatDate(m.match_time)}</small><strong>{m.home_team} – {m.away_team}</strong></div><span className="delivery">{tips.filter(t=>t.match_id===m.id).length}/{players.length} levert</span></div>)}{matches.length===0&&<p className="muted">Ingen kamper er importert ennå.</p>}</div><button className="primaryButton" onClick={()=>setTab("matches")}>Lever tips</button></article></section>
    </>}

    {tab === "matches" && <section className="pageStack"><div className="pageHeading"><div><p className="eyebrow">EHL 2026/27</p><h2>Kamper & tips</h2><p className="muted">Tips lagres nå i Supabase og låses automatisk ved kampstart.</p></div><span className="statusPill">{matches.length} kamper</span></div>{matches.length===0&&<article className="panel"><h3>Terminlisten er tom</h3><p className="muted">Neste del av v0.3 er automatisk import fra HockeyLive/NIF.</p></article>}{matches.map(m=>{const existing=ownTips.find(t=>t.match_id===m.id);return <article className="panel matchDetail" key={m.id}><div><small className="muted">{formatDate(m.match_time)}{m.round ? ` · Runde ${m.round}` : ""}</small><h3>{m.home_team} <span className="versus">–</span> {m.away_team}</h3><span className={m.finished?"delivery complete":"delivery"}>{m.finished&&m.home_score!==null&&m.away_score!==null?`Slutt ${m.home_score}–${m.away_score}`:`${tips.filter(t=>t.match_id===m.id).length}/${players.length} tips levert`}</span></div>{me&&<TipEditor match={m} existing={existing} playerId={me.id} onSaved={load}/>}</article>})}</section>}

    {tab === "tabletips" && <section className="contentGrid"><article className="panel"><div className="panelHeading"><div><p className="eyebrow">Neste sprint</p><h2>Tabelltips</h2></div><span className="statusPill">Prototype</span></div><div className="rankingList">{tablePrediction.map((team,i)=><div className="rankingItem" key={team}><span className="rank">{i+1}</span><strong>{team}</strong></div>)}</div></article><article className="panel"><h3>Kommer i v0.4</h3><p className="muted">Lagring, låsedato og automatisk plasseringsavvik.</p></article></section>}

    {tab === "stats" && <section className="pageStack"><div className="pageHeading"><div><p className="eyebrow">Ekte data</p><h2>Statistikk</h2></div></div><section className="statsGrid">{standings.map(p=><article className="miniCard" key={p.id}><span>Treff</span><strong>{p.display_name}</strong><small>{p.points} poeng · {p.exact} eksakte · {p.correct} riktige</small></article>)}</section><article className="panel"><h3>Poengregler</h3><p className="muted">5 poeng for eksakt resultat · 3 poeng for riktig kamputfall · 0 ellers.</p></article></section>}

    {tab === "awards" && <section className="pageStack"><div className="pageHeading"><div><p className="eyebrow">Moro & rivalisering</p><h2>Awards</h2></div></div><div className="awardGrid"><article className="awardCard"><div className="awardIcon">👑</div><span>Eksperten</span><strong>{standings[0]?.display_name || "–"}</strong><small>Leder sammenlagt</small></article><article className="awardCard"><div className="awardIcon">🎯</div><span>Sniper</span><strong>{[...standings].sort((a,b)=>b.exact-a.exact)[0]?.display_name || "–"}</strong><small>Flest eksakte</small></article><article className="awardCard"><div className="awardIcon">🧊</div><span>Iskald</span><strong>{standings.at(-1)?.display_name || "–"}</strong><small>Trenger en god runde</small></article></div></section>}

    {tab === "profile" && <section className="pageStack"><article className="profileHero"><div className="profileAvatar">{initials}</div><div><p className="eyebrow">Min profil</p><h2>{me?.display_name || "Spiller"}</h2><p className="muted">{me?.email || "Demo-modus"}{me?.admin ? " · Admin" : ""}</p></div></article><section className="statsGrid"><article className="miniCard"><span>Poeng</span><strong>{standings.find(x=>x.id===me?.id)?.points ?? 0}</strong><small>Sesongen</small></article><article className="miniCard"><span>Eksakte</span><strong>{standings.find(x=>x.id===me?.id)?.exact ?? 0}</strong><small>Sesongen</small></article><article className="miniCard"><span>Mine tips</span><strong>{ownTips.length}</strong><small>Lagret</small></article><article className="miniCard"><span>Rolle</span><strong>{me?.admin ? "Admin" : "Spiller"}</strong><small>Stang Inn</small></article></section></section>}

    <footer className="footer">Stang Inn · v0.3</footer>
  </main>;
}
