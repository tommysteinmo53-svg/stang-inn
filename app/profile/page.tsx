"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase";

type Player = { id: string; display_name: string; email: string | null; admin: boolean };

export default function ProfilePage() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) { setLoading(false); return; }
      const { data: session } = await supabase.auth.getSession();
      const id = session.session?.user.id;
      if (!id) { setLoading(false); return; }
      const { data } = await supabase.from("players").select("id,display_name,email,admin").eq("id", id).maybeSingle();
      setPlayer((data || null) as Player | null);
      setLoading(false);
    })();
  }, []);

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) return <main className="appShell"><p className="muted">Laster profil …</p></main>;

  return <main className="appShell">
    <header className="topbar premiumTopbar">
      <a href="/" className="brand brandButton" style={{ textDecoration: "none" }}>
        <div className="brandMark">🏒</div>
        <div><p className="eyebrow">EHL 2026/27</p><h1>Profil</h1></div>
      </a>
    </header>

    <section className="pageStack" style={{ marginTop: 24 }}>
      <article className="profileHero premiumProfileHero">
        <div className="profileAvatar">{(player?.display_name || "S").slice(0,1).toUpperCase()}</div>
        <div>
          <p className="eyebrow">Min konto</p>
          <h2>{player?.display_name || "Spiller"}</h2>
          <p className="muted">{player?.email || ""}</p>
          {player?.admin && <span className="statusPill" style={{ marginTop: 10 }}>👑 Administrator</span>}
        </div>
      </article>

      <article className="panel">
        <div className="panelHeading"><div><p className="eyebrow">Konto</p><h3>Snarveier</h3></div></div>
        <div className="profileActionGrid">
          <a href={player ? `/player/${player.id}` : "/leaderboard"} className="profileActionCard"><span>📊</span><strong>Min statistikk</strong><small>Poeng, treff og historikk</small></a>
          <a href="/notifications" className="profileActionCard"><span>🔔</span><strong>Varsler</strong><small>Se varsler og historikk</small></a>
        </div>
      </article>

      {player?.admin && <article className="panel adminHub">
        <div className="panelHeading"><div><p className="eyebrow">Administrator</p><h3>Adminverktøy</h3></div></div>
        <div className="profileActionGrid">
          <a href="/admin" className="profileActionCard"><span>👥</span><strong>Brukere</strong><small>Endre og slette brukere</small></a>
          <a href="/admin/season" className="profileActionCard"><span>⚙️</span><strong>Sesongdrift</strong><small>Kamper, poeng og synk</small></a>
          <a href="/admin/notifications" className="profileActionCard"><span>📣</span><strong>Send varsel</strong><small>Varsle alle eller én bruker</small></a>
          <a href="/fantasy" className="profileActionCard"><span>🏒</span><strong>Fantasy Hockey</strong><small>Analyse, poeng og anbefalinger</small></a>
          <a href="/admin" className="profileActionCard"><span>🛠️</span><strong>Systemstatus</strong><small>Logger og administrasjon</small></a>
        </div>
      </article>}

      <button className="loadMore" onClick={signOut}>Logg ut</button>
    </section>
  </main>;
}
