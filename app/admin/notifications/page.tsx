"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase";

type Player = { id: string; display_name: string; admin: boolean };

export default function AdminNotificationsPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [target, setTarget] = useState("");
  const [type, setType] = useState("admin");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [expires, setExpires] = useState("");
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) { setAllowed(false); return; }
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id;
      if (!uid) { setAllowed(false); return; }
      const { data: me } = await supabase.from("players").select("admin").eq("id", uid).maybeSingle();
      if (!me?.admin) { setAllowed(false); return; }
      setAllowed(true);
      const { data } = await supabase.from("players").select("id,display_name,admin").order("display_name");
      setPlayers((data || []) as Player[]);
    })();
  }, []);

  async function send() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    setSending(true); setStatus("Sender varsel …");
    const response = await fetch("/api/admin/notifications", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ title, message, type, user_id: target || null, link: link || null, expires_at: expires ? new Date(expires).toISOString() : null }),
    });
    const result = await response.json();
    setSending(false);
    if (!result.ok) { setStatus(`Feil: ${result.error}`); return; }
    setStatus("✓ Varslet er sendt."); setTitle(""); setMessage(""); setLink(""); setExpires("");
  }

  if (allowed === null) return <main className="appShell"><p className="muted">Sjekker admin-tilgang …</p></main>;
  if (!allowed) return <main className="appShell"><article className="panel"><h2>Ingen tilgang</h2></article></main>;

  return <main className="appShell">
    <header className="topbar"><a href="/admin" className="brand brandButton" style={{textDecoration:"none"}}><div className="brandMark">📢</div><div><p className="eyebrow">Administrasjon</p><h1>Varsler</h1></div></a><a href="/admin" className="textButton">← Admin</a></header>
    <section className="pageStack" style={{marginTop:24}}>
      <article className="panel"><div className="panelHeading"><div><p className="eyebrow">Nytt varsel</p><h2>Send melding</h2></div></div>
        <div className="pageStack" style={{gap:12}}>
          <label><span className="muted">Mottaker</span><select className="roundSelect" style={{width:"100%"}} value={target} onChange={e=>setTarget(e.target.value)}><option value="">Alle brukere</option>{players.map(p=><option key={p.id} value={p.id}>{p.display_name}</option>)}</select></label>
          <label><span className="muted">Type</span><select className="roundSelect" style={{width:"100%"}} value={type} onChange={e=>setType(e.target.value)}><option value="admin">📢 Adminmelding</option><option value="round">🏒 Runde</option><option value="warning">⏰ Påminnelse</option><option value="score">🎯 Poeng</option><option value="info">🔔 Info</option></select></label>
          <label><span className="muted">Tittel</span><input className="matchSearch" style={{width:"100%"}} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Husk å levere tips" /></label>
          <label><span className="muted">Melding</span><textarea className="matchSearch" style={{width:"100%",minHeight:110,resize:"vertical"}} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Skriv meldingen …" /></label>
          <label><span className="muted">Lenke i appen (valgfritt)</span><input className="matchSearch" style={{width:"100%"}} value={link} onChange={e=>setLink(e.target.value)} placeholder="/tips eller /round" /></label>
          <label><span className="muted">Utløper (valgfritt)</span><input className="matchSearch" style={{width:"100%"}} type="datetime-local" value={expires} onChange={e=>setExpires(e.target.value)} /></label>
          <button className="primaryButton" disabled={sending || !title.trim() || !message.trim()} onClick={send}>{sending ? "Sender …" : "🔔 Send varsel"}</button>
        </div>
      </article>
      {status&&<article className="quoteCard"><span>Status</span><p>{status}</p></article>}
    </section>
  </main>;
}
