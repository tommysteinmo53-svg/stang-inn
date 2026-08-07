# 🏒 Stang Inn

Privat tippeapp for norsk ishockey — bygget for kamptips, tabelltips, statistikk, rivalisering og litt vennskapelig skadefryd.

## Mål

Stang Inn skal erstatte Excel-arket med en mobilvennlig webapp der deltakerne kan:

- tippe kampresultater før kampstart
- følge sammenlagtstillingen automatisk
- levere tabelltips
- se statistikk, streaks og poengutvikling
- kåre månedsvinner, Sniper, Ukens bom og flere awards
- hente terminliste, resultater og tabell automatisk fra EHL/HockeyLive når datatilgangen er på plass

## Teknologi

- Next.js + React + TypeScript
- Supabase for database og e-postinnlogging
- Vercel for hosting

## Supabase-oppsett

1. Kopier `.env.example` til `.env.local`.
2. Legg inn `NEXT_PUBLIC_SUPABASE_URL` og `NEXT_PUBLIC_SUPABASE_ANON_KEY` fra Supabase-prosjektet.
3. Åpne Supabase → SQL Editor og kjør hele `supabase/schema.sql`.
4. Sørg for at Email-provider er aktivert under Authentication.
5. Start appen med `npm install` og `npm run dev`.
6. Hver deltaker logger inn én gang med e-post. Profil opprettes automatisk.
7. Endre `display_name` i `profiles`-tabellen og sett `is_admin = true` på administratoren.

**Ikke legg hemmelige nøkler i GitHub.** `.env.local` skal forbli lokal og miljøvariabler settes separat i Vercel ved deploy.

Hvis Supabase-miljøvariablene ikke er satt, kjører appen fortsatt i demo-modus slik at designet kan testes.

## Status

- ✅ v0.1: design, dashboard og fungerende navigasjon
- ✅ v0.2 kode: Supabase-klient, magic-link-innlogging, profiler, adminrolle og RLS
- ⏳ Supabase-prosjektet må kobles til med miljøvariabler og SQL-skjema (#4)
- 🚧 v0.3: kamptips, poengsystem og EHL-synk

Se [roadmap](docs/roadmap.md) for planen videre.
