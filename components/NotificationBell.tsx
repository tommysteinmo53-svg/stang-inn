"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase";

type Notification = { id: number; user_id: string | null; expires_at: string | null };
type ReadRow = { notification_id: number; user_id: string };
type Match = { id: number; match_time: string | null; finished: boolean };
type Tip = { player_id: string; match_id: number };

export default function NotificationBell() {
  const [uid, setUid] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [reads, setReads] = useState<ReadRow[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [tips, setTips] = useState<Tip[]>([]);

  async function load() {
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
  }

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const unread = useMemo(() => {
    if (!uid) return 0;
    const readIds = new Set(reads.map(r => r.notification_id));
    const now = Date.now();
    const stored = notifications.filter(n => (!n.expires_at || new Date(n.expires_at).getTime() > now) && !readIds.has(n.id)).length;
    const tipped = new Set(tips.map(t => t.match_id));
    const missing = matches.filter(m => !m.finished && !!m.match_time && new Date(m.match_time).getTime() > now && !tipped.has(m.id)).length;
    return stored + (missing > 0 ? 1 : 0);
  }, [uid, reads, notifications, matches, tips]);

  return <a href="/notifications" aria-label="Åpne varsler" className="topNotificationBell">
    <span aria-hidden>🔔</span>
    {unread > 0 && <b>{unread > 99 ? "99+" : unread}</b>}
  </a>;
}
