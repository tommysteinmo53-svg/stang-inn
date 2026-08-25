# Stang Inn – MASTERPLAN

> Prosjektets operative kontrollsenter. GitHub `main` er teknisk source of truth. Denne filen gir oversikt, prioritering og sporbarhet.

Sist oppdatert: 2026-08-25

## Arbeidsregler

- Før kodeendringer: kontroller alltid faktisk status på `main`.
- Ett hovedpunkt om gangen: status → plan → implementering → test → verifisering → ferdig.
- Et punkt markeres ikke ferdig før implementasjonen finnes på `main` og er verifisert.
- Isolerte E2E-tester skal aldri endre ekte 2026/27-data og skal rydde opp egne testdata.
- Auth/RLS/sikkerhet skal ikke svekkes for å få tester til å fungere.
- Hvis Supabase-SQL må kjøres manuelt: gi én komplett SQL-blokk, vent på resultat, verifiser, fortsett deretter.
- Arbeidschatter kan diskutere detaljer; masterplan-chatten skal holdes kort og oppdatert.
- Ved ferdigstillelse skal siste `main` og denne prioriteringskøen leses før neste chat anbefales.

## Statuskoder

- ⬜ Ikke startet
- 🟡 Pågår / delvis implementert
- ✅ Implementert og verifisert
- 🔴 Blokkert / krever handling
- 🔵 Kontinuerlig drift / vedlikehold

## Overordnet mål

Stang Inn skal være en mobilvennlig webapp for norsk ishockey med to hovedprodukter:

1. **Stang Inn tipping** – kamptips, tabelltips, statistikk, awards og konkurranse.
2. **Stang Inn XI / EHL Fantasy** – komplett fantasyspill for EHL 2026/27 med automatisk datainnhenting, lagbygging, scoring, runder, leaderboard, analyse og beslutningsstøtte.

---

# MP-01 – Plattform, auth, database og drift

**Status: ✅ produksjons-/driftsgrunnlag verifisert / 🔵 løpende sikkerhets- og sesongdrift**

- MP-01.1 ✅ Next.js / React / TypeScript-applikasjon etablert.
- MP-01.2 ✅ Supabase og innlogging etablert.
- MP-01.3 ✅ RLS/RPC-/rollegrenser er produksjonskontrollert og ytterligere hardnet i MP-01.6; sikkerhetsregresjon fortsetter løpende ved nye funksjoner.
- MP-01.4 ✅ Vercel/produksjonsoppsett etablert.
- MP-01.5 ✅ GitHub Actions build-CI inkluderer MP-01 produksjonsdrift, MP-12 scoring/security/test-isolation, MP-13 scoring/readiness/felles miniligaer, MP-04 transfer, Bonus Weeks, MP-07 historikk/stats/identitet/Event Weeks og MP-10 optimizer før build.
- MP-01.6 ✅ **Samlet produksjons-/driftschecklist før sesongstart:** Vercel/CI, Supabase-produksjon, auth/onboarding, RLS/RPC-grenser, migrations/schema, cron/EHL-HockeyLive-synk, fail-closed feil/retry, Fantasy/Tipping-produksjonsdata, testisolasjon, adminrutiner, observability og rollback er kontrollert mot produksjonen. HockeyLive har intern timeout og delvise synkfeil gir nå `ok=false`/HTTP 500 slik at cron kan retry-e. Service-only flater er hardnet uten å svekke auth/RLS. Supabase-organisasjonen `Hockeytips` er verifisert på **Pro** 2026-08-25, slik at managed-backup-forutsetningen er etablert. Operativ runbook ligger i `docs/MP01_PRODUCTION_RUNBOOK.md`. Handoff: **Chat 14 – MP-14.1–14.7 endelig launch-gate**.
- MP-01.7 ✅ **Obligatorisk brukerprofilnavn:** eksplisitt Stang Inn-profilnavn med onboarding/completion-state, servervalidering og hardened tilgang er implementert og produksjonsverifisert 2026-08-24.

> Øvrige MP-punkter videreføres uendret fra forrige masterplanversjon. MP-01.6-endringen over er den autoritative statusoppdateringen for denne arbeidsøkten.
