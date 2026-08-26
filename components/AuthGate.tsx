"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "../lib/supabase";

type SessionProfile = {
  display_name: string;
  admin: boolean;
  profile_name_confirmed_at: string | null;
  deactivated_at: string | null;
} | null;

const AUTH_TIMEOUT_MS = 8_000;

async function withTimeout<T>(operation: PromiseLike<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(operation),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} tok for lang tid`)), AUTH_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function normalizeName(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function hasCompleteProfile(profile: SessionProfile) {
  if (!profile?.profile_name_confirmed_at) return false;
  const name = normalizeName(profile.display_name);
  return name.length >= 2 && name.length <= 60;
}

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/onboarding")) return "/";
  return value;
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!isSupabaseConfigured);
  const [profile, setProfile] = useState<SessionProfile>(null);
  const [routeKind, setRouteKind] = useState<"app" | "login" | "onboarding">("app");
  const [authError, setAuthError] = useState<string | null>(null);
  const [accountDisabled, setAccountDisabled] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    let cancelled = false;

    const check = async () => {
      const path = window.location.pathname;
      const loginPage = path === "/login";
      const onboardingPage = path === "/onboarding";
      setRouteKind(loginPage ? "login" : onboardingPage ? "onboarding" : "app");

      if (loginPage) {
        setReady(true);
        return;
      }

      try {
        setAuthError(null);
        const { data } = await withTimeout(supabase.auth.getSession(), "Innloggingskontroll");
        if (cancelled) return;

        const session = data.session;
        if (!session) {
          const requested = `${window.location.pathname}${window.location.search}`;
          window.location.replace(`/login?next=${encodeURIComponent(requested)}`);
          return;
        }

        const user = session.user;
        const { data: player } = await withTimeout(
          supabase
            .from("players")
            .select("display_name,admin,profile_name_confirmed_at,deactivated_at")
            .eq("id", user.id)
            .maybeSingle(),
          "Profilkontroll",
        );
        if (cancelled) return;

        const loadedProfile = player ?? null;
        if (loadedProfile?.deactivated_at) {
          setProfile(null);
          setAccountDisabled(true);
          setReady(false);
          await supabase.auth.signOut({ scope: "local" });
          return;
        }

        setProfile(loadedProfile);
        const complete = hasCompleteProfile(loadedProfile);

        if (!complete && !onboardingPage) {
          const requested = `${window.location.pathname}${window.location.search}`;
          window.location.replace(`/onboarding?next=${encodeURIComponent(requested)}`);
          return;
        }

        if (complete && onboardingPage) {
          const next = safeNext(new URLSearchParams(window.location.search).get("next"));
          window.location.replace(next);
          return;
        }

        setReady(true);
      } catch (error) {
        if (cancelled) return;
        console.error("AuthGate failed", error);
        setAuthError("Vi får ikke kontakt med innloggingstjenesten akkurat nå.");
        setReady(false);
      }
    };

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase?.auth.signOut();
    window.location.replace("/login");
  }

  if (accountDisabled) {
    return (
      <main style={{ padding: 32, color: "#f4f8ff", maxWidth: 640, margin: "0 auto" }}>
        <h1 style={{ fontSize: 24, marginBottom: 12 }}>Kontoen er deaktivert</h1>
        <p style={{ color: "#b9c8dc", lineHeight: 1.6 }}>
          Denne Stang Inn-kontoen er deaktivert av administrator. Konkurransehistorikken din er bevart, men kontoen kan ikke brukes før den blir gjenåpnet.
        </p>
        <a href="/login" style={{ display: "inline-block", marginTop: 18, borderRadius: 10, padding: "10px 14px", background: "#1d3658", color: "#f4f8ff", textDecoration: "none", fontWeight: 800 }}>
          Til innlogging
        </a>
      </main>
    );
  }

  if (authError) {
    return (
      <main style={{ padding: 32, color: "#f4f8ff", maxWidth: 640, margin: "0 auto" }}>
        <h1 style={{ fontSize: 24, marginBottom: 12 }}>Stang Inn har problemer med innloggingen</h1>
        <p style={{ color: "#b9c8dc", lineHeight: 1.6 }}>{authError}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{ marginTop: 18, border: 0, borderRadius: 10, padding: "10px 14px", background: "#1d3658", color: "#f4f8ff", cursor: "pointer", fontWeight: 800 }}
        >
          Prøv igjen
        </button>
      </main>
    );
  }

  if (!ready) return <main style={{ padding: 32, color: "#f4f8ff" }}>Laster Stang Inn …</main>;

  return (
    <>
      {children}
      {isSupabaseConfigured && routeKind === "app" && (
        <aside style={{ position: "fixed", right: 12, bottom: 12, zIndex: 50, display: "flex", alignItems: "center", gap: 9, padding: "9px 10px", borderRadius: 13, background: "rgba(8,20,37,.96)", border: "1px solid #223a5d", boxShadow: "0 12px 28px rgba(0,0,0,.3)", color: "#f4f8ff", fontSize: 12 }}>
          <div>
            <strong style={{ display: "block" }}>{profile?.display_name || "Spiller"}{profile?.admin ? " · Admin" : ""}</strong>
            <span style={{ color: "#96a9c5" }}>Innlogget</span>
          </div>
          <a href="/fantasy" style={{ borderRadius: 9, padding: "7px 9px", background: "#214b3d", color: "#e4fff4", textDecoration: "none", fontWeight: 800 }}>Fantasy</a>
          {profile?.admin && <a href="/admin" style={{ borderRadius: 9, padding: "7px 9px", background: "#1d3658", color: "#d9e8fb", textDecoration: "none", fontWeight: 800 }}>Admin</a>}
          <button onClick={signOut} style={{ border: 0, borderRadius: 9, padding: "7px 9px", background: "#142640", color: "#d9e8fb", cursor: "pointer", fontWeight: 800 }}>Logg ut</button>
        </aside>
      )}
    </>
  );
}
