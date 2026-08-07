"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "../lib/supabase";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const check = async () => {
      const path = window.location.pathname;
      if (path === "/login") {
        setReady(true);
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        window.location.replace("/login");
        return;
      }
      setReady(true);
    };

    check();
  }, []);

  if (!ready) {
    return <main className="authLoading">Laster Stang Inn …</main>;
  }

  return <>{children}</>;
}
