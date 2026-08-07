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

1. Kopier `.env.example` til `.env.local` ved lokal utvikling.
2. Legg inn `NEXT_PUBLIC_SUPABASE_URL` og `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` fra Supabase-prosjektet.
3. Åpne Supabase → SQL Editor og kjør `supabase/schema.sql` på et nytt prosjekt. Eksisterende prosjekt kan migreres separat.
4. Sørg for at Email-provider er aktivert under Authentication.
5. Hver deltaker logger inn én gang med e-post. Appen oppretter en rad i `players` automatisk hvis den mangler.
6. Endre `display_name` i `players`-tabellen og sett `admin = true` på administratoren.

**Ikke legg hemmelige nøkler i GitHub.** Til første deploy trenger nettleserappen bare Project URL og Publishable key. Eventuelle secret/service-role-nøkler kommer senere på serversiden.

Hvis Supabase-miljøvariablene ikke er satt, kjører appen i demo-modus slik at designet fortsatt kan testes.

## Vercel

Sett disse to miljøvariablene før deploy:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Framework preset skal være Next.js og Root Directory skal være `./`.

## Status

- ✅ v0.1: design, dashboard og fungerende navigasjon
- ✅ v0.2 kode: Supabase-klient, magic-link-innlogging, spillerprofil, adminfelt og RLS
- ⏳ v0.2b: koble miljøvariabler i Vercel og teste første innlogging
- 🚧 v0.3: kamptips, poengsystem og EHL-synk

Se [roadmap](docs/roadmap.md) for planen videre.
