"use client";

import { FormEvent, useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "../../lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabaseBrowserClient();
    supabase?.auth.getSession().then(({ data }) => {
      if (data.session) window.location.replace("/");
    });
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!isSupabaseConfigured) {
      setMessage("Supabase er ikke koblet til ennå. Legg inn miljøvariablene først.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    setMessage(error ? error.message : "Innloggingslenken er sendt. Sjekk e-posten din 🏒");
  }

  return (
    <main className="loginShell">
      <section className="loginCard">
        <div className="brandMark loginMark">🏒</div>
        <p className="eyebrow">EHL 2026/27</p>
        <h1>Stang Inn</h1>
        <p className="muted">Logg inn med e-post for å levere tips og følge ligaen.</p>

        <form className="loginForm" onSubmit={submit}>
          <label htmlFor="email">E-post</label>
          <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="navn@epost.no" />
          <button className="primaryButton" type="submit" disabled={loading}>{loading ? "Sender …" : "Send innloggingslenke"}</button>
        </form>

        {!isSupabaseConfigured && <div className="setupNotice">Demo-modus: Supabase-miljøvariablene mangler. Appen kan fortsatt vises lokalt, men innlogging er ikke aktivert.</div>}
        {message && <p className="loginMessage">{message}</p>}
      </section>
    </main>
  );
}
