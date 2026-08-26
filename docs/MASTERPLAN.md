# Stang Inn – MASTERPLAN

> Prosjektets operative kontrollsenter. GitHub `main` er teknisk source of truth. Denne filen gir oversikt, prioritering og sporbarhet.

Sist oppdatert: 2026-08-26

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
- MP-01.6 ✅ **Samlet produksjons-/driftschecklist før sesongstart:** Vercel/CI, Supabase-produksjon, auth/onboarding, RLS/RPC-grenser, migrations/schema, cron/EHL-HockeyLive-synk, fail-closed feil/retry, Fantasy/Tipping-produksjonsdata, testisolasjon, adminrutiner, observability og rollback er kontrollert mot produksjonen. HockeyLive har intern timeout og delvise synkfeil gir `ok=false`/HTTP 500 slik at cron kan retry-e. Service-only flater er hardnet uten å svekke auth/RLS. Supabase-organisasjonen `Hockeytips` er verifisert på **Pro** 2026-08-25, slik at managed-backup-forutsetningen er etablert. Operativ runbook ligger i `docs/MP01_PRODUCTION_RUNBOOK.md`.
- MP-01.7 ✅ **Obligatorisk brukerprofilnavn:** eksplisitt Stang Inn-profilnavn med onboarding/completion-state, servervalidering og hardened tilgang er implementert og produksjonsverifisert 2026-08-24.

# MP-02 – EHL-data, terminliste og spilleridentitet

**Status: ✅ preseason-spillerpool verifisert / 🔵 løpende drift**

- MP-02.1 ✅ EHL 2026/27 Tournament ID `448981` etablert.
- MP-02.2 ✅ Terminlisteimport og kampdata etablert.
- MP-02.3 ✅ Preseason-spillerpool verifisert mot EliteProspects.
- MP-02.4 ✅ Full roster-gate: 239/239 matchet, 0 mangler, 0 tvetydige, 0 lagavvik, 0 ekstra og 0 posisjonsavvik.
- MP-02.5 ✅ Robust identitetsmatching, duplicate checks, reviewed aliases og admin-audit finnes.
- MP-02.6 🔵 Løpende roster- og kampdatasynk gjennom sesongen.

# MP-03 – Fantasypriser og spillerøkonomi

**Status: ✅ preseason-priser og fast 2026/27-prispolicy ferdigstilt**

- MP-03.1–MP-03.5 ✅ Historisk prisgrunnlag, v4-modellfamilie og publiseringsspor er etablert.
- MP-03.6 ✅ V4.6.2 er publisert og produksjonsverifisert: 239/239 current-roster-spillere har låst sesongpris og er kjøpbare; 0 lag over 100m ved kontroll.
- MP-03.7 ✅ **Faste spillerpriser 2026/27:** alle kjøp, salg og lagverdier bruker den låste `fantasy_player_season_prices`-prisen. Det skal ikke forekomme automatiske markedsprisendringer eller manuell reprising etter sesongstart. Databasen blokkerer UPDATE/DELETE av eksisterende 2026/27-sesongpriser etter første ordinære kampstart, også via admin/service-role, og hindrer `fantasy_players.price` i å divergere fra en eksisterende låst sesongpris. En helt ny spiller som kommer inn etter sesongstart kan få én førstegangspris; deretter er prisen låst resten av sesongen. Produksjonsverifisert 2026-08-25 med 239/239 current-roster-priser, 0 prisavvik og 0 stale `purchase_price`-rader.

# MP-04 – Lagbygger, regler og brukerlag

**Status: ✅ transfer-/regel-/lagnavnkjernen ferdigstilt / 🔵 sesongvedlikehold**

- MP-04.1 ✅ Persistente fantasybrukerlag etablert.
- MP-04.2 ✅ Kaptein og visekaptein støttes.
- MP-04.3 ✅ Klubbbegrensning og sentrale lagvalideringer implementert.
- MP-04.4 ✅ Lagbygger/UI er sluttpolert for mobil og desktop gjennom MP-11.
- MP-04.5 ✅ Full transfersyklus: maks 2 permanente bytter per ordinær runde, ingen bank/hits, Bytteboost opptil 4, transferledger og brukerhistorikk.
- MP-04.6 ✅ Endelig låseregelverk er dokumentert; rekke/C/VC/lagnavn er gratis endringer, Event Weeks sperrer permanente transfers og deadline-snapshot er historisk fasit.
- MP-04.7 ✅ Motstandere i aktuell fantasy-gameweek vises på hver spiller med H/B og støtte for 0/1/flere kamper via autoritativ rundelogikk.
- MP-04.8 ✅ **Obligatorisk lagnavn:** nye Fantasy-lag kan ikke lagres med tomt navn, whitespace eller placeholder som `Mitt lag`. Felles servervalidator normaliserer whitespace, krever 3–40 tegn, alfanumerisk innhold og avviser kontrolltegn/placeholders. `fantasy_user_teams` har triggergate og authenticated-only `rename_fantasy_team_v1`. Lagbyggeren krever eksplisitt navn og gir eksisterende placeholder-lag en rename-only kompletteringsflyt uten å endre team-ID, roster, C/VC, transfers, snapshots, boostere eller poeng. Navneendring teller ikke som transfer. Produksjonsverifisert 2026-08-24; eksisterende placeholder-lag ble bevisst ikke automatisk omskrevet.

# MP-05 – Fantasy-runder, deadlines og snapshots

**Status: ✅ kjerne implementert**

- MP-05.1–MP-05.6 ✅ Kalenderbaserte runder, flyttede kamper, første-kamp-deadline, snapshots/readiness og isolerte testkontroller er implementert.
- MP-05.7 🔵 Regresjonstest ved endringer i runde-/deadline-logikk.

# MP-06 – Fantasy scoring og kampstatistikk

**Status: 🟡 / kjerne ferdig**

- MP-06.1–MP-06.4 ✅ Poengmotor, special teams, forward-flex og C×2/VC×1,5 er implementert og testet.
- MP-06.5 🟡 Keeperlogikk/shutout/reconciliation overvåkes mot ekte kamper.
- MP-06.6 ⬜ Full produksjonsvalidering mot representative 2026/27-seriekamper når de finnes.

# MP-07 – Leaderboard, rundesider og konkurranse

**Status: ✅ konkurranse- og Event Week-kjerne ferdigstilt**

- MP-07.1–MP-07.9 ✅ Leaderboard, runder, tie-break, Bonus Weeks, snapshot-first rundehistorikk og personlig statistikkdashboard er implementert og verifisert.
- MP-07.10 ✅ **Lagnavn + eiernavn i Fantasy-tabeller:** globalt leaderboard, månedspresentasjon og identitetsbevisste rundehistorikk-/runde-RPC-er viser både Fantasy-lagnavn og bekreftet Stang Inn-profilnavn uten å endre ranking, scoring eller tie-break. Historisk navnepolicy er låst: sesongtabellen viser dagens lagnavn + dagens bekreftede profilnavn; historiske runder viser snapshot-frosset `team_name` + nytt snapshot-frosset `owner_name`; månedstabell bruker identiteten fra lagets siste snapshot i måneden. Snapshot-triggeren fryser kun bekreftet `players.display_name`, aldri e-post. Produksjonen hadde 0 2026/27-snapshots ved migrasjon, så ingen historikk ble omskrevet. Nye RPC-er er authenticated-only (`anon` uten EXECUTE), MP-07.10-regresjon kjører i CI, og Vercel er grønn. Eksisterende private Fantasy-miniliga viste allerede lagnavn + profilnavn og ble derfor ikke endret i denne oppgaven.
- MP-07.11 ✅ **Produksjonskonfigurerte Event Weeks:** GW15 Rik Onkel (200m) og GW38 Fattig Onkel (70m) er produksjonsmigrert og verifisert mot de 45 autoritative rundene, fem kamper/10 lag, første-kamp-deadline, separate eventlag, permanent transfer-/boostersperre, snapshot/scoring-kjede, kalender/UI, rundehistorikk/leaderboard, auth/RLS og regresjon før/etter eventrundene. Produksjonsverifisert 2026-08-25.
- MP-07.12 ✅ **Julebord – GW22:** «Alle skal med!» er produksjonsmigrert på autoritativ GW22. Snapshotet fryser `christmas_party` med rekke 2 = 100 %, mens ordinær C×2 og VC×1,5 beholdes fra sesongreglene; personlige boostere og permanente transfers er sperret. Kalender/UI, rundehistorikk, leaderboard, auth/RLS og Event Week-regresjon er verifisert. Produksjonsverifisert 2026-08-25.

# MP-08 – Analyse, xFP og anbefalinger

**Status: ✅ produksjonsverifisert**

- MP-08.1–MP-08.8 ✅ Analyse-command-center, xFP, form/verdi, fixture-rating, kjøp/hold/selg, kapteinscore og horisonter er implementert. Preseason-FP er bevisst avviklet som Fantasy-signal.

# MP-09 – Skader, fravær og tilgjengelighet

**Status: ✅ kjerne produksjonsverifisert / 🔵 løpende drift**

- MP-09.1–MP-09.7 ✅ Availability-datamodell, admin/review, kilder, sikker matching, analyse/optimizer-effekt og varsling er implementert og verifisert.

# MP-10 – Lagoptimalisator

**Status: ✅ adminverktøy produksjonsverifisert**

- MP-10.1–MP-10.5 ✅ Lag/budsjett/transferstatus/låste spillere, UT→INN, xFP-gevinst/risiko, strategier, availability/fixture og autoritative transferregler er implementert.
- **Admin-only-policy ✅:** Lagoptimalisatoren er et internt analyseverktøy og skal kun være tilgjengelig under adminverktøyet. Offentlig `/fantasy/optimizer`, offentlig optimizer-API og vanlig Fantasy-navigasjon er fjernet; optimizer-RPC-er/endepunkter er beskyttet av admin-gate.
- **Transferstatus/låste spillere – produksjonsfiks ✅ 2026-08-26:** `get_fantasy_transfer_status_v1` returnerer eksplisitt `permanent_transfers_allowed`, slik at optimizeren bruker den autoritative 0/2/4-kontrakten korrekt: 2 permanente bytter i ordinær runde, opptil 4 med Bytteboost og 0 i Rik/Fattig Onkel. Dette rettet feilen der 2/2 ledige bytter kunne vises samtidig som transferregelen feilaktig sto som «Sperret». Produksjonsverifisert med låste spillere: låste spillere beholdes, mens ulåste spillere kan foreslås UT når et gyldig bedre bytte finnes.

# MP-11 – UI/UX og mobilopplevelse

**Status: ✅ redesign/branding og samlet mobil-/desktop-pass ferdigstilt**

- MP-11.1–MP-11.7 ✅ Navigasjon, Fantasy-/tippingflater, mobil, states og samlet UX-polering er implementert.
- MP-11.8 ✅ **Stang Inn-redesign, logo og visuell merkevare:** valgt premium sportsretning er implementert på `main` med Stang Inn-logo/SI-mark, samlet shell/header/navigasjon, svart/gull merkevare, metadata/favicon/app-assets og konsistent Fantasy/Tipping/admin-presentasjon. Mobil og desktop er sluttverifisert, og produksjonsbuild/Vercel er grønn.

# MP-12 – Testing, sikkerhet og datakvalitet

**Status: ✅ endelig bred pre-launch-regresjon ferdigstilt / 🔵 regresjonsvedlikehold**

- MP-12.1–MP-12.7 ✅ CI, isolerte E2E-gater, sikkerhet og bred sluttregresjon er etablert og bestått etter identitets-, lagnavn-, miniliga-, Event Week- og MP-11.8-endringene. Ingen test skal endre ekte 2026/27-data.
- MP-01.6 har i tillegg lagt produksjonsdriftskontrakter inn i CI for cron-secret/retry, HockeyLive-timeout, partial-sync failure og service-only hardening.

# MP-13 – Stang Inn tipping

**Status: ✅ preseasonklar kjerne + felles miniligaer / 🔵 live-verifisering gjennom sesongen**

- MP-13.1–MP-13.5 ✅ Kamptips, tabelltips, automatisk scoring, awards/statistikk og sesongklar brukerflyt er implementert; live-verifisering fortsetter på reelle sesongdata.
- MP-13.6 ✅ **Felles miniligaer på tvers av Tipping og Fantasy:** én kanonisk `stang_inn_private_leagues` + `stang_inn_private_league_members`-modell er produksjonsmigrert fra begge legacy-produktene uten tap av liga-ID, invitasjonskode, eier, medlemskap eller `joined_at`. Legacy-tabellene beholdes som immutable migreringshistorikk, mens gamle Fantasy-/Tipping-RPC-er er kompatibilitetswrappere mot den kanoniske modellen. Create/join/list/leave og medlemskontroll er authenticated-only; `anon` har ikke EXECUTE, og vanlige klientroller har ingen direkte tabelltilgang. Ligaeier er ligadmin og kan ikke forlate ligaen; ordinær utmelding fjerner medlemskapet fra begge produkter og rejoin via samme invitasjonskode gjenoppretter begge. `/leagues` er felles brukerflate med Tipping-/Fantasy-faner; gamle `/fantasy/leagues`-ruter redirecter dit. Fantasy-tabellen filtrerer den autoritative `get_fantasy_competition_table_v2` og beholder tie-break totalpoeng → rundeseire → beste runde, med Fantasy-lagnavn + bekreftet profilnavn. Tipping-tabellen beholder eksisterende 5/3/0- og poeng → eksakte → riktige utfall-logikk med Stang Inn-profilnavn. Ingen e-post/private profilfelt eksponeres. Rollback-only behavioral produksjonstest verifiserte Fantasy-create → Tipping-synlighet, Tipping-join → Fantasy-synlighet, separate standings med samme medlemmer, leave/rejoin, owner-sperre og 0 testrester. MP-13.6-regresjon er koblet til CI og Vercel-build er grønn 2026-08-24.

# MP-14 – Lansering EHL 2026/27

**Status: ✅ GO LIVE gjennomført 2026-08-26 / 🔵 sesongdrift**

- MP-14.1 ✅ Endelig Fantasy-regelverk verifisert mot produksjonskode, database og publiserte regler.
- MP-14.2 ✅ Spillerpool, lag, posisjoner, kjøpbarhet og låste priser verifisert i produksjon.
- MP-14.3 ✅ Alle 45 runder, 225 kampkoblinger, deadlines og Event Weeks verifisert.
- MP-14.4 ✅ Preseason launch-regresjon for scoring, snapshots, transfers, rundehistorikk og leaderboard bestått. MP-06.6 står fortsatt åpen for live kampdatavalidering.
- MP-14.5 ✅ Produksjonsmiljø, Supabase, Vercel, CI, cron/synk, auth/RLS og testisolasjon verifisert.
- MP-14.6 ✅ Faktisk mobil/desktop smoke-test gjennomført; funnet mobilavvik i spillermarkedet ble rettet, deployet og re-verifisert.
- MP-14.7 ✅ Backup, rollback og admin-/incidentrutiner verifisert og dokumentert.
- MP-14.8 ✅ **GO LIVE godkjent av produkteier og gjennomført kontrollert 2026-08-26.** Siste godkjente `main` var grønn i GitHub Actions/Vercel, Supabase var `ACTIVE_HEALTHY`, 45/45 runder og 225/225 kampkoblinger var intakte, current roster var 239/239 korrekt priset/kjøpbar med 0 prisavvik, tre Event Weeks var publisert, og ferske HockeyLive-synker var `ok=true`. Ingen unødvendig redeploy eller featureendring ble gjort som del av launch.

---

## Prioritert arbeidskø

Stang Inn er nå i sesongbasert driftsfase.

1. **🔵 Løpende sesongdrift:** MP-02.6 roster-/kampdatasynk, MP-09 availability, MP-13 live-verifisering, cron/sync/CI og produksjonsobservability følges gjennom sesongen.
2. **MP-06.6 – live kampdatavalidering:** gjennomføres i Chat 06 når representative ekte 2026/27-seriekamper finnes. Punktet skal stå åpent til da.
3. Ved incident brukes `docs/MP01_PRODUCTION_RUNBOOK.md`; dataintegritet og snapshot-/scoringfasit prioriteres foran ad-hoc korrigering.

## Fast handoff mellom arbeidschatter

Når et steg faktisk er ferdig:

- **✅ Ferdig:** `MP-XX.YY – kort navn`.
- **Verifisert:** finnes på `main` + relevante tester/kontroller bestått.
- **➡️ Neste prioritet:** `Chat NN – navn`, `MP-XX.YY – konkret neste oppgave`.
- **Hvorfor nå:** kort forklaring på avhengigheten/prioriteringen.

Hvis arbeidet ikke er på `main`, verifikasjon mangler eller nødvendig manuell SQL gjenstår, skal punktet ikke markeres ferdig.