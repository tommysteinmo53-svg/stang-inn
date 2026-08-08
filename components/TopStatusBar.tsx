"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase";

type StatusPayload = { version?: string; commit?: string };
type Notification = { id: number; user_id: string | null; expires_at: string | null };
type ReadRow = { notification_id: number; user_id: string };
type Match = { id: number; match_time: string | null; finished: boolean };
type Tip = { player_id: string; match_id: number };

export default function TopStatusBar() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [reads, setReads] = useState<ReadRow[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [tips, setTips] = useState<Tip[]>([]);
  const [now, setNow] = useState(Date.now());

  async function loadNotifications() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user.id || null;
    setUid(userId);
    if (!userId) return;

    const [n, r, m, t] = await Promise.all([
      supabase.from("notifications").select("id,user_id,expires_at").order("created_at", { ascending: false }),
      supabase.from("notification_reads").select("notification_id,user_id").eq("user_id", userId),
      supabase.from("matches").select("id,match_time,finished"),
      supabase.from("tips").select("player_id,match_id").eq("player_id", userId),
    ]);
    setNotifications((n.data || []) as Notification[]);
    setReads((r.data || []) as ReadRow[]);
    setMatches((m.data || []) as Match[]);
    setTips((t.data || []) as Tip[]);
    setNow(Date.now());
  }

  useEffect(() => {
    fetch("/api/system-status", { cache: "no-store" })
      .then(r => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const liveCount = useMemo(() => matches.filter(m => {
    if (m.finished || !m.match_time) return false;
    const start = new Date(m.match_time).getTime();
    return start <= now && now - start < 4 * 60 * 60 * 1000;
  }).length, [matches, now]);

  const unread = useMemo(() => {
    if (!uid) return 0;
    const readIds = new Set(reads.map(r => r.notification_id));
    const stored = notifications.filter(n => (!n.expires_at || new Date(n.expires_at).getTime() > now) && !readIds.has(n.id)).length;
    const tipped = new Set(tips.map(t => t.match_id));
    const missingSoon = matches.filter(m => {
      if (m.finished || !m.match_time || tipped.has(m.id)) return false;
      const start = new Date(m.match_time).getTime();
      return start > now && start - now <= 24 * 60 * 60 * 1000;
    }).length;
    const recentFinished = matches.filter(m => {
      if (!m.finished || !m.match_time) return false;
      const start = new Date(m.match_time).getTime();
      return start <= now && now - start < 6 * 60 * 60 * 1000;
    }).length;
    // Automatic events are grouped so the badge stays useful instead of exploding on a full round.
    return stored + (missingSoon > 0 ? 1 : 0) + (liveCount > 0 ? 1 : 0) + (recentFinished > 0 ? 1 : 0);
  }, [uid, notifications, reads, matches, tips, now, liveCount]);

  const version = status?.version || "0.7.0";
  const commit = status?.commit || "…";

  return (
    <div className="topStatusBar" role="navigation" aria-label="Status, live og varsler">
      <a href="/profile" className="topStatusItem topStatusVersion" title="Versjon og profil">
        <span className="topStatusLogo">🏒</span>
        <span>v{version}</span>
        <span className="topStatusDivider">•</span>
        <strong>{commit}</strong>
      </a>
      <div className="topStatusActions">
        <a href="/live" className={`topStatusItem topStatusLive ${liveCount > 0 ? "isLive" : ""}`} aria-label={liveCount > 0 ? `Live-senter, ${liveCount} kamp${liveCount === 1 ? "" : "er"} pågår` : "Live-senter"}>
          <span className="topStatusLiveDot" aria-hidden />
          <span>{liveCount > 0 ? "LIVE" : "Live"}</span>
          {liveCount > 0 && <b className="topStatusLiveCount">{liveCount}</b>}
        </a>
        <a href="/notifications" className="topStatusItem topStatusNotifications" aria-label={`Varsler${unread ? `, ${unread} aktive` : ""}`}>
          <span>🔔</span>
          <span>Varsler</span>
          {unread > 0 && <b className="topStatusBadge">{unread > 99 ? "99+" : unread}</b>}
        </a>
      </div>
    </div>
  );
}
