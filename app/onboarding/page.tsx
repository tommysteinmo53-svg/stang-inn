"use client";

import { FormEvent, useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "../../lib/supabase";
import styles from "./page.module.css";

type StoredProfile = {
  display_name: string;
  profile_name_confirmed_at: string | null;
};

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/onboarding")) return "/";
  return value;
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function suggestedAuthName(metadata: Record<string, unknown> | undefined) {
  if (!metadata) return "";
  for (const key of ["display_name", "full_name", "name"]) {
    const value = metadata[key];
    if (typeof value === "string") {
      const normalized = normalizeName(value);
      if (normalized.length >= 2 && normalized.length <= 60) return normalized;
    }
  }
  return "";
}

export default function OnboardingPage() {
  const [next, setNext] = useState("/");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const requestedNext = safeNext(new URLSearchParams(window.location.search).get("next"));
    setNext(requestedNext);

    if (!isSupabaseConfigured) {
      setLoading(false);
      setMessage("Supabase er ikke koblet til.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let cancelled = false;

    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (cancelled) return;
      const user = sessionData.session?.user;
      if (!user) {
        const onboardingTarget = `/onboarding?next=${encodeURIComponent(requestedNext)}`;
        window.location.replace(`/login?next=${encodeURIComponent(onboardingTarget)}`);
        return;
      }

      const { data: profileData } = await supabase
        .from("players")
        .select("display_name,profile_name_confirmed_at")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const profile = profileData as StoredProfile | null;

      if (profile?.profile_name_confirmed_at && normalizeName(profile.display_name).length >= 2) {
        window.location.replace(requestedNext);
        return;
      }

      const existing = profile ? normalizeName(profile.display_name) : "";
      setName(existing.length >= 2 && existing.length <= 60 ? existing : suggestedAuthName(user.user_metadata));
      setLoading(false);
    }

    load().catch((error) => {
      console.error("Profile onboarding load failed", error);
      if (!cancelled) {
        setLoading(false);
        setMessage("Vi klarte ikke å hente profilen din. Prøv igjen.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const normalized = normalizeName(name);
    if (normalized.length < 2) {
      setMessage("Navnet må være minst 2 tegn langt.");
      return;
    }
    if (normalized.length > 60) {
      setMessage("Navnet kan være maks 60 tegn langt.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setSaving(true);
    setMessage("");

    const { error } = await supabase.rpc("complete_stanginn_profile_v1", { p_display_name: normalized });
    if (error) {
      setSaving(false);
      setMessage(error.message || "Navnet kunne ikke lagres. Prøv igjen.");
      return;
    }

    window.location.replace(next);
  }

  return (
    <main className={styles.shell}>
      <section className={styles.card} aria-labelledby="profile-heading">
        <div className={styles.mark}>🏒</div>
        <p className={styles.eyebrow}>Stang Inn-profil</p>
        <h1 id="profile-heading" className={styles.title}>Hva skal vi kalle deg?</h1>
        <p className={styles.intro}>
          Bekreft navnet du vil bruke i Stang Inn. Dette blir visningsnavnet ditt i Tipping, Fantasy,
          leaderboards og miniligaer. E-postadressen din vises ikke som konkurransenavn.
        </p>

        {loading ? (
          <p className={styles.status}>Henter profilen din …</p>
        ) : (
          <form className={styles.form} onSubmit={submit}>
            <label htmlFor="display-name">Profilnavn</label>
            <input
              id="display-name"
              name="display-name"
              type="text"
              autoComplete="name"
              minLength={2}
              maxLength={60}
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Fornavn Etternavn"
              autoFocus
            />
            <div className={styles.meta}>
              <span>2–60 tegn</span>
              <span>{normalizeName(name).length}/60</span>
            </div>
            <button type="submit" disabled={saving}>
              {saving ? "Lagrer …" : "Bekreft profilnavn"}
            </button>
          </form>
        )}

        {message && <p className={styles.message} role="alert">{message}</p>}
        <p className={styles.helper}>Du kan senere endre visningsnavnet uten at det påvirker poeng, lag eller historikk.</p>
      </section>
    </main>
  );
}
