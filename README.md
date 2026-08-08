# 🏒 Stang Inn

Privat tippeapp for norsk ishockey — bygget for kamptips, tabelltips, statistikk, rivalisering og litt vennskapelig skadefryd.

## Mål

Stang Inn skal erstatte Excel-arket med en mobilvennlig webapp der deltakerne kan:

- tippe kampresultater før kampstart
- følge sammenlagtstillingen automatisk
- levere tabelltips
- se statistikk, streaks og poengutvikling
- kåre månedsvinner, Sniper, Ukens bom og flere awards
- hente terminliste, resultater og tabell automatisk fra EHL/HockeyLive

## Teknologi

- Next.js + React + TypeScript
- Supabase for database og e-postinnlogging
- Vercel for hosting
- NIF Data API / HockeyLive for EHL-data

## Supabase

Nettleserappen bruker:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Serversynk bruker i tillegg:

- `SUPABASE_SECRET_KEY` — Supabase sin nye `sb_secret_...`-nøkkel. Skal bare ligge i Vercel/servermiljø.

Kjør SQL-filene i rekkefølge i Supabase SQL Editor. På det eksisterende prosjektet er `v0.3.sql` og deretter `v0.4.sql` aktuelle migrasjoner.

## EHL / HockeyLive-synk

EHL 2026/27 bruker som standard:

- Tournament ID: `448981`
- Season label: `2026/27`

Server-endepunktet ligger på `/api/sync-ehl` og henter kamper/resultater via NIF `TournamentMatches`.

Miljøvariabler:

- `NIF_TOURNAMENT_ID=448981`
- `NIF_SEASON_LABEL=2026/27`
- `NIF_DATA_TOKEN` hvis NIF krever partner-token med `data_ta_read`
- `CRON_SECRET` før automatisk planlagt synk aktiveres

Hvis NIF returnerer 401/403 trenger prosjektet partner/API-tilgang fra NIF. Tokenet skal aldri ligge i GitHub eller klientkode.

## Vercel

Framework preset: Next.js  
Root Directory: `./`

Etter miljøvariabelendringer må prosjektet redeployes.

## Status

- ✅ v0.1: design, dashboard og fungerende navigasjon
- ✅ v0.2: Supabase, magic-link-innlogging, spillerprofiler og RLS
- ✅ v0.2b: Supabase + Vercel-produksjonsdeploy
- 🚧 v0.3: ekte kamptips, poengsystem og EHL-synk
- ✅ serverside EHL-importkode og TournamentMatches-klient
- ⏳ kjør `supabase/v0.4.sql`, legg inn server-secret og test NIF-tilgang

Se [roadmap](docs/roadmap.md) for planen videre.

<!-- redeploy trigger: Vercel Pro enabled 2026-08-08 -->
