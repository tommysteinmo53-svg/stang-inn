"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "../lib/supabase";

type SessionProfile = { display_name: string; admin: boolean } | null;

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!isSupabaseConfigured);
  const [profile, setProfile] = useState<SessionProfile>(null);
  const [email, setEmail] = useState("");
  const [onLoginPage, setOnLoginPage] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const check = async () => {
      const path = window.location.pathname;
      const loginPage = path === "/login";
      setOnLoginPage(loginPage);

      if (loginPage) {
        setReady(true);
        return;
      }

      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session) {
        window.location.replace("/login");
        return;
      }

      const user = session.user;
      const userEmail = user.email ?? "";
      setEmail(userEmail);

      let { data: player } = await supabase
        .from("players")
        .select("display_name,admin")
        .eq("id", user.id)
        .maybeSingle();

      if (!player) {
        const suggestedName =
          (user.user_metadata?.display_name as string | undefined) ||
          userEmail.split("@")[0] ||
          "Spiller";

        const { data: created } = await supabase
          .from("players")
          .upsert(
            {
              id: user.id,
              display_name: suggestedName,
              email: userEmail || null,
              admin: false,
            },
            { onConflict: "id" },
          )
          .select("display_name,admin")
          .single();

        player = created;
      }

      setProfile(player ?? null);
      setReady(true);
    };

    check();
  }, []);

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase?.auth.signOut();
    window.location.replace("/login");
  }

  if (!ready) {
    return <main style={{ padding: 32, color: "#f4f8ff" }}>Laster Stang Inn …</main>;
  }

  return (
    <>
      {children}
      {isSupabaseConfigured && !onLoginPage && (
        <aside
          style={{
            position: "fixed",
            right: 12,
            bottom: 12,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: "9px 10px",
            borderRadius: 13,
            background: "rgba(8,20,37,.96)",
            border: "1px solid #223a5d",
            boxShadow: "0 12px 28px rgba(0,0,0,.3)",
            color: "#f4f8ff",
            fontSize: 12,
          }}
        >
          <div>
            <strong style={{ display: "block" }}>
              {profile?.display_name || email || "Spiller"}
              {profile?.admin ? " · Admin" : ""}
            </strong>
            <span style={{ color: "#96a9c5" }}>Innlogget</span>
          </div>
          <button
            onClick={signOut}
            style={{
              border: 0,
              borderRadius: 9,
              padding: "7px 9px",
              background: "#142640",
              color: "#d9e8fb",
              cursor: "pointer",
              fontWeight: 800,
            }}
          >
            Logg ut
          </button>
        </aside>
      )}
    </>
  );
}
