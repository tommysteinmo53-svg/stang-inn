"use client";

import { FormEvent, useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "../../lib/supabase";
import styles from "./page.module.css";

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
      email: email.trim(),
    });

    setLoading(false);
    setMessage(error ? `${error.message}${error.status ? ` (HTTP ${error.status})` : ""}` : "Innloggingslenken er sendt. Sjekk e-posten din 🏒");
  }

  return (
    <main className={styles.shell}>
      <section className={styles.card}>
        <div className={styles.mark}>🏒</div>
        <p className={styles.eyebrow}>EHL 2026/27</p>
        <h1 className={styles.title}>Stang Inn</h1>
        <p className={styles.muted}>Logg inn med e-post for å levere tips og følge ligaen.</p>

        <form className={styles.form} onSubmit={submit}>
          <label htmlFor="email">E-post</label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="navn@epost.no" />
          <button className={styles.button} type="submit" disabled={loading}>{loading ? "Sender …" : "Send innloggingslenke"}</button>
        </form>

        {!isSupabaseConfigured && <div className={styles.notice}>Demo-modus: Supabase-miljøvariablene mangler. Appen kan fortsatt vises lokalt, men innlogging er ikke aktivert.</div>}
        {message && <p className={styles.message}>{message}</p>}
      </section>
    </main>
  );
}
