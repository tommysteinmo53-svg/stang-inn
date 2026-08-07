"use client";

import { useEffect, useMemo, useState } from "react";
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

type Player = {
  id: string;
  display_name: string;
  email: string | null;
  admin: boolean;
  created_at: string;
};

type TipOwner = { player_id: string };

type EditState = {
  display_name: string;
  email: string;
  admin: boolean;
};

export default function AdminPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [tips, setTips] = useState<TipOwner[]>([]);
  const [message, setMessage] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState>({ display_name: "", email: "", admin: false });
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");

  async function load() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) { setAllowed(false); return; }
    setCurrentUserId(user.id);

    const { data: player } = await supabase.from("players").select("admin").eq("id", user.id).maybeSingle();
    if (!player?.admin) { setAllowed(false); return; }
    setAllowed(true);

    const [runsResult, playersResult, tipsResult] = await Promise.all([
      supabase
        .from("sync_runs")
        .select("id,provider,started_at,finished_at,ok,imported_count,finished_count,error_message")
        .order("started_at", { ascending: false })
        .limit(10),
      supabase
        .from("players")
        .select("id,display_name,email,admin,created_at")
        .order("created_at", { ascending: true }),
      supabase.from("tips").select("player_id"),
    ]);

    setRuns((runsResult.data || []) as SyncRun[]);
    setPlayers((playersResult.data || []) as Player[]);
    setTips((tipsResult.data || []) as TipOwner[]);
  }

  useEffect(() => { load(); }, []);

  async function accessToken() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  }

  async function sync() {
    const token = await accessToken();
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

  function startEdit(player: Player) {
    setEditingId(player.id);
    setEdit({ display_name: player.display_name, email: player.email || "", admin: player.admin });
    setMessage("");
  }

  async function saveUser(id: string) {
    const token = await accessToken();
    if (!token) return;
    setSavingId(id);
    setMessage("Lagrer bruker …");

    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...edit }),
    });
    const result = await response.json();
    setSavingId(null);

    if (!result.ok) {
      setMessage(`Feil: ${result.error}`);
      return;
    }

    setEditingId(null);
    setMessage("✓ Brukeren er oppdatert.");
    await load();
  }

  async function deleteUser(player: Player) {
    if (player.id === currentUserId) {
      setMessage("Du kan ikke slette din egen administratorkonto.");
      return;
    }

    const confirmed = window.confirm(`Slette ${player.display_name}? Alle tips fra denne brukeren blir også slettet. Dette kan ikke angres.`);
    if (!confirmed) return;

    const token = await accessToken();
    if (!token) return;
    setDeletingId(player.id);
    setMessage(`Sletter ${player.display_name} …`);

    const response = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id: player.id }),
    });
    const result = await response.json();
    setDeletingId(null);

    if (!result.ok) {
      setMessage(`Feil: ${result.error}`);
      return;
    }

    setMessage(`✓ ${player.display_name} er slettet.`);
    if (editingId === player.id) setEditingId(null);
    await load();
  }

  const tipCounts = useMemo(() => {
    const counts = new Map<string, number>();
    tips.forEach(tip => counts.set(tip.player_id, (counts.get(tip.player_id) || 0) + 1));
    return counts;
  }, [tips]);

  const visiblePlayers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return players;
    return players.filter(player => `${player.display_name} ${player.email || ""}`.toLowerCase().includes(q));
  }, [players, userSearch]);

  if (allowed === null) return <main className="appShell"><p className="muted">Sjekker admin-tilgang …</p></main>;
  if (!allowed) return <main className="appShell"><article className="panel"><h2>Ingen tilgang</h2><p className="muted">Denne siden er bare for administrator.</p><a href="/" className="textButton">← Tilbake til Stang Inn</a></article></main>;

  return <main className="appShell">
    <header className="topbar"><div className="brand"><div className="brandMark">🏒</div><div><p className="eyebrow">Administrasjon</p><h1>Stang Inn</h1></div></div><a href="/" className="textButton">Til appen →</a></header>

    <section className="pageStack" style={{ marginTop: 24 }}>
      <article className="heroCard">
        <div><p className="eyebrow">EHL-data</p><h2>Terminliste & resultater</h2><p className="muted">Henter HockeyLive-data og oppdaterer Supabase uten duplikater.</p></div>
        <button className="compactButton" disabled={syncing} onClick={sync}>{syncing ? "Synkroniserer …" : "🔄 Synkroniser EHL"}</button>
      </article>
      {message && <article className="quoteCard"><span>Status</span><p>{message}</p></article>}

      <article className="panel">
        <div className="panelHeading">
          <div><p className="eyebrow">Brukere</p><h3>Administrer spillere</h3></div>
          <span className="statusPill">{players.length} brukere</span>
        </div>
        <input
          className="matchSearch"
          value={userSearch}
          onChange={e => setUserSearch(e.target.value)}
          placeholder="Søk navn eller e-post …"
          style={{ width: "100%", marginBottom: 12 }}
        />

        <div className="pageStack">
          {visiblePlayers.map(player => {
            const isEditing = editingId === player.id;
            const isSelf = player.id === currentUserId;
            return <div key={player.id} style={{ padding: 14, border: "1px solid var(--line)", borderRadius: 14, background: "#0a1729" }}>
              {!isEditing ? <>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div>
                    <strong style={{ fontSize: 18 }}>{player.display_name}</strong>
                    <div className="muted" style={{ marginTop: 3 }}>{player.email || "Ingen e-post"}</div>
                    <div className="muted" style={{ marginTop: 5, fontSize: 12 }}>
                      {player.admin ? "👑 Administrator" : "Spiller"} · {tipCounts.get(player.id) || 0} tips · opprettet {new Date(player.created_at).toLocaleDateString("no-NO")}{isSelf ? " · deg" : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="compactButton" onClick={() => startEdit(player)}>✏️ Endre</button>
                    <button
                      onClick={() => deleteUser(player)}
                      disabled={isSelf || deletingId === player.id}
                      style={{ padding: "10px 13px", borderRadius: 12, border: "1px solid rgba(255,123,140,.45)", background: "rgba(255,123,140,.1)", color: "#ff9baa", fontWeight: 900 }}
                    >
                      {deletingId === player.id ? "Sletter …" : "🗑️ Slett"}
                    </button>
                  </div>
                </div>
              </> : <>
                <div style={{ display: "grid", gap: 10 }}>
                  <label><span className="muted" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Visningsnavn</span><input className="matchSearch" style={{ width: "100%" }} value={edit.display_name} onChange={e => setEdit(v => ({ ...v, display_name: e.target.value }))} /></label>
                  <label><span className="muted" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>E-post</span><input className="matchSearch" style={{ width: "100%" }} type="email" value={edit.email} onChange={e => setEdit(v => ({ ...v, email: e.target.value }))} /></label>
                  <label style={{ display: "flex", alignItems: "center", gap: 9 }}><input type="checkbox" checked={edit.admin} onChange={e => setEdit(v => ({ ...v, admin: e.target.checked }))} /><span>Administrator</span></label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="compactButton" disabled={savingId === player.id} onClick={() => saveUser(player.id)}>{savingId === player.id ? "Lagrer …" : "Lagre"}</button>
                    <button className="textButton" onClick={() => setEditingId(null)}>Avbryt</button>
                  </div>
                </div>
              </>}
            </div>;
          })}
          {visiblePlayers.length === 0 && <p className="muted">Ingen brukere matcher søket.</p>}
        </div>
      </article>

      <article className="panel">
        <div className="panelHeading"><div><p className="eyebrow">Historikk</p><h3>Siste synkroniseringer</h3></div><span className="statusPill">{runs.length} vist</span></div>
        <div className="simpleList">
          {runs.length === 0 && <p className="muted">Ingen synkroniseringer logget ennå.</p>}
          {runs.map(run => <div key={run.id}>
            <span>{new Date(run.started_at).toLocaleString("no-NO")} · {run.provider}</span>
            <strong>{run.ok ? `✓ ${run.imported_count} kamper` : `✕ ${run.error_message || "Feil"}`}</strong>
          </div>)}
        </div>
      </article>
    </section>
  </main>;
}
