"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "../../lib/supabase";
import styles from "./page.module.css";

const AUTH_RETURN_KEY="stanginn_auth_return";
function safeNext(value:string|null){
 if(!value||!value.startsWith("/")||value.startsWith("//"))return "/";
 return value;
}
function hasGoogleIdentity(user:any){
 const identities=Array.isArray(user?.identities)?user.identities:[];
 const providers=Array.isArray(user?.app_metadata?.providers)?user.app_metadata.providers:[];
 return identities.some((identity:any)=>identity?.provider==="google")||user?.app_metadata?.provider==="google"||providers.includes("google");
}

export default function LoginPage() {
  const params=useSearchParams();
  const next=useMemo(()=>safeNext(params.get("next")),[params]);
  const [message, setMessage] = useState(params.get("reason")==="google_required"?"Stang Inn bruker nå kun Google-innlogging. Velg Google-kontoen din for å fortsette.":"");
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabaseBrowserClient();
    supabase?.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      if (hasGoogleIdentity(data.session.user)) {
        window.location.replace(next);
        return;
      }
      await supabase.auth.signOut({scope:"local"});
      setMessage("Denne innloggingen er ikke koblet til Google. Stang Inn bruker nå kun Google-innlogging.");
    });
  }, [next]);

  function rememberReturn(){
    if(next!=="/")window.localStorage.setItem(AUTH_RETURN_KEY,next);
    else window.localStorage.removeItem(AUTH_RETURN_KEY);
  }

  async function signInWithGoogle() {
    if (!isSupabaseConfigured) { setMessage("Supabase er ikke koblet til ennå."); return; }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    rememberReturn();
    setGoogleLoading(true); setMessage("");
    const callback=next==="/"?`${window.location.origin}/`:`${window.location.origin}/?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback },
    });
    if (error) { setGoogleLoading(false); setMessage(`${error.message}${error.status ? ` (HTTP ${error.status})` : ""}`); }
  }

  return (
    <main className={styles.shell}>
      <section className={styles.card}>
        <div className={styles.mark}>🏒</div>
        <p className={styles.eyebrow}>EHL 2026/27</p>
        <h1 className={styles.title}>Stang Inn</h1>
        <p className={styles.muted}>Én Google-innlogging for Stang Inn Tipping og EHL Fantasy. Lever tips, bygg fantasylaget og følg konkurransene gjennom hele sesongen.</p>

        <button className={styles.googleButton} type="button" onClick={signInWithGoogle} disabled={googleLoading}>
          <span className={styles.googleMark}>G</span>
          {googleLoading ? "Åpner Google …" : "Fortsett med Google"}
        </button>
        <p className={styles.helper}>Stang Inn bruker kun Google-innlogging. Profilnavnet ditt i Stang Inn administreres separat fra Google-kontoens navn.</p>
        {!isSupabaseConfigured && <div className={styles.notice}>Demo-modus: Supabase-miljøvariablene mangler. Appen kan fortsatt vises lokalt, men innlogging er ikke aktivert.</div>}
        {message && <p className={styles.message}>{message}</p>}
      </section>
    </main>
  );
}
