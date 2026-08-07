"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase";

type Notice = { id: number; type: string; title: string; message: string; link: string | null; created_at: string; expires_at: string | null };
type ReadRow = { notification_id: number };
type Match = { id: number; home_team: string; away_team: string; match_time: string | null; finished: boolean; round: number | null };
type Tip = { player_id: string; match_id: number; points: number | null };

function icon(type: string) {
  if (type === "score") return "🎯";
  if (type === "warning") return "⏰";
  if (type === "round") return "🏒";
  if (type === "admin") return "📢";
  return "🔔";
}

export default function NotificationsPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [reads, setReads] = useState<ReadRow[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [tips, setTips] = useState<Tip[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setLoading(false); return; }
    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user.id || null;
    setUid(userId);
    if (!userId) { setLoading(false); return; }
    const [n, r, m, t] = await Promise.all([
      supabase.from("notifications").select("id,type,title,message,link,created_at,expires_at").order("created_at", { ascending: false }),
      supabase.from("notification_reads").select("notification_id").eq("user_id", userId),
      supabase.from("matches").select("id,home_team,away_team,match_time,finished,round").order("match_time"),
      supabase.from("tips").select("player_id,match_id,points").eq("player_id", userId),
    ]);
    setNotices((n.data || []) as Notice[]);
    setReads((r.data || []) as ReadRow[]);
    setMatches((m.data || []) as Match[]);
    setTips((t.data || []) as Tip[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const readIds = useMemo(() => new Set(reads.map(r => r.notification_id)), [reads]);
  const activeNotices = useMemo(() => {
    const now = Date.now();
    return notices.filter(n => !n.expires_at || new Date(n.expires_at).getTime() > now);
  }, [notices]);

  const missing = useMemo(() => {
    const now = Date.now();
    const tipped = new Set(tips.map(t => t.match_id));
    return matches.filter(m => !m.finished && !!m.match_time && new Date(m.match_time).getTime() > now && !tipped.has(m.id));
  }, [matches, tips]);

  const nextRound = useMemo(() => missing.map(m => m.round).filter((r): r is number => r !== null).sort((a,b)=>a-b)[0] ?? null, [missing]);
  const recentPoints = useMemo(() => tips.filter(t => Number(t.points ?? 0) > 0).slice(-5).reverse(), [tips]);

  async function markRead(id: number) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !uid || readIds.has(id)) return;
    await supabase.from("notification_reads").upsert({ notification_id: id, user_id: uid }, { onConflict: "notification_id,user_id" });
    await load();
  }

  async function markAllRead() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !uid) return;
    const rows = activeNotices.filter(n => !readIds.has(n.id)).map(n => ({ notification_id: n.id, user_id: uid }));
    if (rows.length) await supabase.from("notification_reads").upsert(rows, { onConflict: "notification_id,user_id" });
    await load();
  }

  if (loading) return <main className="appShell"><p className="muted">Laster varsler …</p></main>;

  return <main className="appShell">
    <header className="topbar"><a href="/" className="brand brandButton" style={{textDecoration:"none"}}><div className="brandMark">🔔</div><div><p className="eyebrow">Stang Inn</p><h1>Varsler</h1></div></a><a href="/" className="textButton">Til appen →</a></header>
    <section className="pageStack" style={{marginTop:24}}>
      <div className="pageHeading"><div><p className="eyebrow">Varslingssenter</p><h2>Det du bør få med deg</h2></div><button className="compactButton" onClick={markAllRead}>Marker alle som lest</button></div>

      {missing.length > 0 && <article className="panel" style={{border:"1px solid rgba(245,196,81,.45)"}}><div className="panelHeading"><div><p className="eyebrow">⏰ Handling kreves</p><h3>Du mangler {missing.length} tips</h3></div><a className="compactButton" href="/tips">Lever tips</a></div><p className="muted">{nextRound ? `Neste aktuelle runde er runde ${nextRound}. ` : ""}Tipsene låses ved kampstart.</p></article>}

      {recentPoints.length > 0 && <article className="panel"><div className="panelHeading"><div><p className="eyebrow">🎯 Siste poeng</p><h3>Nylige treff</h3></div></div><div className="simpleList">{recentPoints.map(t=>{const m=matches.find(x=>x.id===t.match_id);return <div key={t.match_id}><span>{m ? `${m.home_team} – ${m.away_team}` : `Kamp ${t.match_id}`}</span><strong>+{t.points} p</strong></div>})}</div></article>}

      <article className="panel"><div className="panelHeading"><div><p className="eyebrow">Innboks</p><h3>Meldinger</h3></div><span className="statusPill">{activeNotices.filter(n=>!readIds.has(n.id)).length} ulest</span></div>
        <div className="pageStack" style={{gap:8}}>{activeNotices.map(n=><div key={n.id} onClick={()=>markRead(n.id)} style={{padding:14,borderRadius:14,border:"1px solid var(--line)",background:readIds.has(n.id)?"#0a1729":"rgba(85,184,255,.09)",cursor:"pointer"}}><div style={{display:"flex",justifyContent:"space-between",gap:12}}><strong>{icon(n.type)} {n.title}</strong>{!readIds.has(n.id)&&<span className="statusPill">Ny</span>}</div><p className="muted" style={{margin:"6px 0"}}>{n.message}</p><small className="muted">{new Date(n.created_at).toLocaleString("no-NO")}</small>{n.link&&<div style={{marginTop:8}}><a href={n.link} className="textButton">Åpne →</a></div>}</div>)}</div>
        {activeNotices.length===0&&<p className="muted">Ingen meldinger ennå.</p>}
      </article>
    </section>
  </main>;
}
