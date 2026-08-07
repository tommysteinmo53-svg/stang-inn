"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase";

type SyncRun = {
  id: number;
  provider: string;
  started_at: string;
  finished_at: string | null;
  ok: boolean;
  imported_count: number;
  finished_count: number;
  error_message: string | null;
};

export default function AdminPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [message, setMessage] = useState("");
  const [syncing, setSyncing] = useState(false);

  async function load() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) { setAllowed(false); return; }

    const { data: player } = await supabase.from("players").select("admin").eq("id", user.id).maybeSingle();
    if (!player?.admin) { setAllowed(false); return; }
    setAllowed(true);

    const { data } = await supabase
      .from("sync_runs")
      .select("id,provider,started_at,finished_at,ok,imported_count,finished_count,error_message")
      .order("started_at", { ascending: false })
      .limit(10);
    setRuns((data || []) as SyncRun[]);
  }

  useEffect(() => { load(); }, []);

  async function sync() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    setSyncing(true);
    setMessage("Synkroniserer EHL …");
    const response = await fetch("/api/admin/sync", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json();
    setSyncing(false);
    setMessage(result.ok ? `✓ ${result.imported} kamper synkronisert (${result.finished} ferdigspilt).` : `Feil: ${result.error}`);
    await load();
  }

  if (allowed === null) return <main className="appShell"><p className="muted">Sjekker admin-tilgang …</p></main>;
  if (!allowed) return <main className="appShell"><article className="panel"><h2>Ingen tilgang</h2><p className="muted">Denne siden er bare for administrator.</p><a href="/" className="textButton">← Tilbake til Stang Inn</a></article></main>;

  return <main className="appShell">
    <header className="topbar"><div className="brand"><div className="brandMark">🏒</div><div><p className="eyebrow">Administrasjon</p><h1>Stang Inn</h1></div></div><a href="/" className="textButton">Til appen →</a></header>

    <section className="pageStack" style={{ marginTop: 24 }}>
      <article className="heroCard">
        <div><p className="eyebrow">EHL-data</p><h2>Terminliste & resultater</h2><p className="muted">Henter via valgt dataprovider og oppdaterer Supabase uten duplikater.</p></div>
        <button className="compactButton" disabled={syncing} onClick={sync}>{syncing ? "Synkroniserer …" : "🔄 Synkroniser EHL"}</button>
      </article>
      {message && <article className="quoteCard"><span>Status</span><p>{message}</p></article>}

      <article className="panel">
        <div className="panelHeading"><div><p className="eyebrow">Historikk</p><h3>Siste synkroniseringer</h3></div><span className="statusPill">{runs.length} vist</span></div>
        <div className="simpleList">
          {runs.length === 0 && <p className="muted">Ingen synkroniseringer logget ennå. Kjør v0.5.sql først hvis tabellen mangler.</p>}
          {runs.map(run => <div key={run.id}>
            <span>{new Date(run.started_at).toLocaleString("no-NO")} · {run.provider}</span>
            <strong>{run.ok ? `✓ ${run.imported_count} kamper` : `✕ ${run.error_message || "Feil"}`}</strong>
          </div>)}
        </div>
      </article>
    </section>
  </main>;
}
