"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase";

type Player = { id: string; display_name: string };
type Match = { id: number; home_team: string; away_team: string; match_time: string | null; home_score: number | null; away_score: number | null; finished: boolean; round: number | null };
type Tip = { id?: number; player_id: string; match_id: number; home_tip: number; away_tip: number };
type Filter = "upcoming" | "untipped" | "finished" | "all";

function locked(match: Match) {
  return match.finished || (!!match.match_time && new Date() >= new Date(match.match_time));
}

function fmt(value: string | null) {
  if (!value) return "Tidspunkt ikke satt";
  return new Date(value).toLocaleString("no-NO", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function countdown(value: string | null) {
  if (!value) return "";
  const ms = new Date(value).getTime() - Date.now();
  if (ms <= 0) return "låst";
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}t`;
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours}t ${minutes}m`;
}

function TipEditor({ match, existing, playerId, onSaved }: { match: Match; existing?: Tip; playerId: string; onSaved: () => Promise<void> }) {
  const [home, setHome] = useState(existing?.home_tip ?? 0);
  const [away, setAway] = useState(existing?.away_tip ?? 0);
  const [saving, setSaving] = useState(false);
  const isLocked = locked(match);

  useEffect(() => {
    setHome(existing?.home_tip ?? 0);
    setAway(existing?.away_tip ?? 0);
  }, [existing?.home_tip, existing?.away_tip]);

  async function save() {
    if (isLocked) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setSaving(true);
    const { error } = await supabase.from("tips").upsert(
      { player_id: playerId, match_id: match.id, home_tip: home, away_tip: away },
      { onConflict: "player_id,match_id" },
    );
    setSaving(false);
    if (error) alert(error.message);
    else await onSaved();
  }

  return <div className="tipControls">
    <label><span>H</span><input type="number" min="0" disabled={isLocked} value={home} onChange={e => setHome(Math.max(0, Number(e.target.value)))} /></label>
    <strong>–</strong>
    <label><span>B</span><input type="number" min="0" disabled={isLocked} value={away} onChange={e => setAway(Math.max(0, Number(e.target.value)))} /></label>
    <button className="compactButton" disabled={isLocked || saving} onClick={save}>{isLocked ? "🔒 Låst" : saving ? "Lagrer …" : existing ? "Oppdater" : "Lagre tips"}</button>
  </div>;
}

export default function TipsPage() {
  const [me, setMe] = useState<Player | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [tips, setTips] = useState<Tip[]>([]);
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  async function load() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setLoading(false); return; }
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user.id;
    const [p, m, t] = await Promise.all([
      supabase.from("players").select("id,display_name").order("created_at"),
      supabase.from("matches").select("id,home_team,away_team,match_time,home_score,away_score,finished,round").order("match_time"),
      supabase.from("tips").select("id,player_id,match_id,home_tip,away_tip"),
    ]);
    const ps = (p.data || []) as Player[];
    setPlayers(ps);
    setMe(ps.find(x => x.id === uid) || null);
    setMatches((m.data || []) as Match[]);
    setTips((t.data || []) as Tip[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const ownTips = useMemo(() => tips.filter(t => t.player_id === me?.id), [tips, me]);
  const ownTipMap = useMemo(() => new Map(ownTips.map(t => [t.match_id, t])), [ownTips]);
  const upcoming = useMemo(() => matches.filter(m => !locked(m)), [matches]);
  const finished = useMemo(() => matches.filter(m => locked(m)), [matches]);
  const untipped = useMemo(() => upcoming.filter(m => !ownTipMap.has(m.id)), [upcoming, ownTipMap]);

  const filtered = useMemo(() => {
    let source = filter === "upcoming" ? upcoming : filter === "untipped" ? untipped : filter === "finished" ? finished : matches;
    const q = query.trim().toLowerCase();
    if (q) source = source.filter(m => `${m.home_team} ${m.away_team}`.toLowerCase().includes(q));
    return [...source].sort((a,b)=>(a.round ?? 999)-(b.round ?? 999) || (a.match_time||"").localeCompare(b.match_time||""));
  }, [filter, upcoming, untipped, finished, matches, query]);

  const groups = useMemo(() => {
    const map = new Map<string, Match[]>();
    filtered.forEach(match => {
      const key = match.round === null ? "Uten runde" : `Runde ${match.round}`;
      map.set(key, [...(map.get(key) || []), match]);
    });
    return [...map.entries()];
  }, [filtered]);

  if (loading) return <main className="appShell"><p className="muted">Laster tips …</p></main>;

  return <main className="appShell">
    <header className="topbar">
      <a href="/" className="brand brandButton" style={{ textDecoration: "none" }}><div className="brandMark">🏒</div><div><p className="eyebrow">EHL 2026/27</p><h1>Tips</h1></div></a>
      <a href="/" className="textButton" style={{ textDecoration: "none" }}>Til appen →</a>
    </header>

    <section className="pageStack" style={{ marginTop: 24 }}>
      <article className="heroCard">
        <div><p className="eyebrow">Mine tips</p><h2>{untipped.length === 0 ? "Alt levert ✓" : `${untipped.length} kamper mangler tips`}</h2><p className="muted">Tips kan endres frem til kampstart. Låste kamper merkes med 🔒.</p></div>
        <div className="countdown"><strong>{ownTips.length}</strong><span>lagrede tips</span></div>
      </article>

      <div className="matchToolbar"><input className="matchSearch" value={query} onChange={e => setQuery(e.target.value)} placeholder="Søk lag …" /></div>
      <div className="matchFilters">
        <button className={filter === "upcoming" ? "active" : ""} onClick={() => setFilter("upcoming")}>Kommende <b>{upcoming.length}</b></button>
        <button className={filter === "untipped" ? "active warning" : "warning"} onClick={() => setFilter("untipped")}>Ikke tippet <b>{untipped.length}</b></button>
        <button className={filter === "finished" ? "active" : ""} onClick={() => setFilter("finished")}>Låst <b>{finished.length}</b></button>
        <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Alle</button>
      </div>

      {groups.map(([round, roundMatches]) => <section key={round} className="pageStack" style={{ gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
          <div><p className="eyebrow" style={{ marginBottom: 2 }}>{round}</p><strong>{roundMatches.length} kamper</strong></div>
          <span className="statusPill">{roundMatches.filter(m => ownTipMap.has(m.id)).length}/{roundMatches.length} tippet</span>
        </div>
        {roundMatches.map(match => {
          const existing = ownTipMap.get(match.id);
          const delivered = tips.filter(t => t.match_id === match.id).length;
          const isLocked = locked(match);
          return <article className={`panel matchDetail ${existing ? "hasTip" : ""}`} key={match.id}>
            <div className="matchInfo">
              <small className="muted">{isLocked ? "🔒 " : ""}{fmt(match.match_time)}</small>
              <h3>{match.home_team} <span className="versus">–</span> {match.away_team}</h3>
              {match.finished && match.home_score !== null && match.away_score !== null
                ? <span className="delivery complete">Slutt {match.home_score}–{match.away_score}{existing ? ` · ditt tips ${existing.home_tip}–${existing.away_tip}` : ""}</span>
                : existing
                  ? <span className="delivery complete">✓ Lagret: {existing.home_tip}–{existing.away_tip} · {delivered}/{players.length} levert</span>
                  : isLocked
                    ? <span className="delivery">🔒 Ingen tips levert</span>
                    : <span className="delivery">⚠ Ikke tippet · låses om {countdown(match.match_time)}</span>}
              <div style={{ marginTop: 8 }}><a href={`/match/${match.id}`} className="textButton" style={{ textDecoration: "none" }}>Åpne kampside →</a></div>
            </div>
            {me && <TipEditor match={match} existing={existing} playerId={me.id} onSaved={load} />}
          </article>;
        })}
      </section>)}

      {groups.length === 0 && <article className="panel emptyState"><strong>Ingen kamper her.</strong><span>Prøv et annet filter eller søk.</span></article>}
    </section>
  </main>;
}
