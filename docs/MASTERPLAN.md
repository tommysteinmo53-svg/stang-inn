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

- MP-01.1–MP-01.7 ✅ Plattform, Supabase/auth, RLS, Vercel, CI, produksjonsrunbook og profilnavn er etablert og produksjonsverifisert.
- MP-01.6 inkluderer Vercel/CI, Supabase, auth/onboarding, RLS/RPC, migrations/schema, cron/EHL-HockeyLive-synk, fail-closed retry, testisolasjon, adminrutiner, observability, backup og rollback. Operativ runbook: `docs/MP01_PRODUCTION_RUNBOOK.md`.

# MP-02 – EHL-data, terminliste og spilleridentitet

**Status: ✅ preseason-spillerpool verifisert / 🔵 løpende drift**

- MP-02.1–MP-02.5 ✅ Tournament ID `448981`, terminliste/kampdata, preseason-roster, identitetsmatching og roster-gate er etablert og verifisert.
- MP-02.6 🔵 Løpende roster- og kampdatasynk gjennom sesongen.

# MP-03 – Fantasypriser og spillerøkonomi

**Status: ✅ preseason-priser og fast 2026/27-prispolicy ferdigstilt**

- MP-03.1–MP-03.6 ✅ Historisk prisgrunnlag, v4-modellfamilie, publisering og V4.6.2 preseason-priser er etablert og produksjonsverifisert.
- MP-03.7 ✅ **Faste spillerpriser 2026/27:** eksisterende spilleres sesongpris kan ikke reprises etter sesongstart. En helt ny spiller kan få én førstegangspris; denne låses deretter resten av sesongen. Kjøp, salg og lagverdi bruker låst sesongpris.

# MP-04 – Lagbygger, regler og brukerlag

**Status: ✅ transfer-/regel-/lagnavnkjernen ferdigstilt / 🔵 sesongvedlikehold**

- MP-04.1–MP-04.8 ✅ Persistente lag, C/VC, klubb-/lagvalidering, lagbygger, transfers, deadline-/snapshotregler, GW-motstandere og obligatorisk lagnavn er implementert og verifisert.

# MP-05 – Fantasy-runder, deadlines og snapshots

**Status: ✅ kjerne implementert / 🔵 regresjonsvedlikehold**

- MP-05.1–MP-05.6 ✅ Kalenderbaserte runder, flyttede kamper, første-kamp-deadline, snapshots/readiness og isolerte testkontroller er implementert.
- MP-05.7 🔵 Regresjonstest ved endringer i runde-/deadline-logikk.

# MP-06 – Fantasy scoring og kampstatistikk

**Status: 🟡 / kjerne ferdig**

- MP-06.1–MP-06.4 ✅ Poengmotor, special teams, forward-flex og C×2/VC×1,5 er implementert og testet.
- MP-06.5 🟡 Keeperlogikk/shutout/reconciliation overvåkes mot ekte kamper.
- MP-06.6 ⬜ Full produksjonsvalidering mot representative 2026/27-seriekamper når de finnes.

# MP-07 – Leaderboard, rundesider og konkurranse

**Status: ✅ konkurranse- og Event Week-kjerne ferdigstilt**

- MP-07.1–MP-07.12 ✅ Leaderboard, runder, tie-break, Bonus Weeks, historikk/stats, lagnavn + eiernavn og Event Weeks (GW15 Rik Onkel, GW22 Julebord, GW38 Fattig Onkel) er implementert og produksjonsverifisert.

# MP-08 – Analyse, xFP og anbefalinger

**Status: ✅ produksjonsverifisert**

- MP-08.1–MP-08.8 ✅ Analyse-command-center, xFP, form/verdi, fixture-rating, kjøp/hold/selg, kapteinscore og horisonter er implementert.

# MP-09 – Skader, fravær og tilgjengelighet

**Status: ✅ kjerne produksjonsverifisert / 🔵 løpende drift**

- MP-09.1–MP-09.7 ✅ Availability-datamodell, admin/review, kilder, sikker matching, analyse/optimizer-effekt og varsling er implementert og verifisert.

# MP-10 – Lagoptimalisator

**Status: ✅ adminverktøy produksjonsverifisert**

- MP-10.1–MP-10.5 ✅ Lag/budsjett/transferstatus/låste spillere, UT→INN, xFP-gevinst/risiko, strategier, availability/fixture og autoritative transferregler er implementert.
- Lagoptimalisatoren er admin-only. Offentlig optimizer/API er fjernet og optimizer-RPC-er/endepunkter er beskyttet av admin-gate.

# MP-11 – UI/UX og mobilopplevelse

**Status: ✅ redesign/branding og samlet mobil-/desktop-pass ferdigstilt**

- MP-11.1–MP-11.8 ✅ Navigasjon, Fantasy/Tipping-flater, mobil, states, UX-polering og Stang Inn-redesign/logo/branding er implementert og verifisert.

# MP-12 – Testing, sikkerhet og datakvalitet

**Status: ✅ endelig bred pre-launch-regresjon ferdigstilt / 🔵 regresjonsvedlikehold**

- MP-12.1–MP-12.7 ✅ CI, isolerte E2E-gater, sikkerhet og bred sluttregresjon er etablert og bestått. Ingen test skal endre ekte 2026/27-data.

# MP-13 – Stang Inn tipping

**Status: ✅ preseasonklar kjerne + felles miniligaer / 🔵 live-verifisering gjennom sesongen**

- MP-13.1–MP-13.6 ✅ Kamptips, tabelltips, automatisk scoring, awards/statistikk, brukerflyt og felles miniligaer på tvers av Tipping/Fantasy er implementert.
- 🔵 Live-verifisering fortsetter på reelle sesongdata.

# MP-14 – Lansering EHL 2026/27

**Status: ✅ GO LIVE gjennomført 2026-08-26 / 🔵 sesongdrift**

- MP-14.1–MP-14.7 ✅ Launch-gatene er PASS: regelverk, spillerpool/priser, 45 runder/225 kampkoblinger, preseason scoring/snapshot/leaderboard-regresjon, produksjonsmiljø, mobil/desktop smoke og backup/rollback/adminrutiner.
- MP-14.8 ✅ **GO LIVE godkjent av produkteier og gjennomført kontrollert 2026-08-26.**
- MP-06.6 står fortsatt åpen som planlagt live kampdatavalidering og er ikke lukket av preseason-gaten.

---

# Sesongdrift 2026/27 – fast arbeidsfordeling

Dette avsnittet er operativ fasit for hvor hendelser og vedlikeholdsoppgaver skal håndteres etter GO LIVE. Styringschatten brukes til prioritering og tverrgående beslutninger; detaljarbeid gjøres i riktig arbeidschat.

## 1. Ny spiller kommer til EHL

**Eier først: Chat 02 – MP-02.6. Deretter Chat 03 ved behov.**

Arbeidsflyt:

1. Chat 02 verifiserer at spilleren faktisk er ny i current roster og ikke en eksisterende spiller med alternativ stavemåte/ID.
2. Identitet, HockeyLive/NIF-ID når tilgjengelig, klubb, posisjon og rosterstatus verifiseres. Usikker eller tvetydig matching skal stoppes for manuell kontroll; det skal aldri opprettes en ny spiller bare fordi automatisk matching er usikker.
3. Først når identiteten er sikker kan spilleren synkes/opprettes som current-roster-spiller.
4. Chat 03 setter **én førstegangspris** etter gjeldende prismodell og dokumenterer grunnlaget. Eksisterende spillerpriser skal ikke brukes som snarvei dersom spilleren faktisk er ny.
5. Førstegangsprisen låses deretter for resten av 2026/27 etter MP-03.7.
6. Kjøpbarhet åpnes først når identitet, klubb, posisjon og låst sesongpris er på plass og verifisert.
7. Ved behov vurderer Chat 08 analyse/xFP når tilstrekkelig datagrunnlag finnes, og Chat 09 håndterer eventuell availability-status.

**Sikkerhetsregel:** Ny spiller skal ikke bli kjøpbar i Fantasy før identitet og førstegangspris er verifisert.

## 2. Eksisterende spiller bytter EHL-klubb

**Eier: Chat 02 – MP-02.6. Chat 04 kobles inn hvis klubbskiftet påvirker gyldigheten til eksisterende Fantasy-lag.**

- Behold samme spilleridentitet og historikk; ikke opprett duplikat.
- Oppdater klubbtilhørighet først når klubbskiftet er sikkert verifisert.
- Spillerens låste 2026/27-pris endres **ikke** på grunn av klubbskiftet.
- Historiske kampdata, snapshots og tidligere rundepoeng skal fortsatt tilhøre samme spiller og skal ikke omskrives.
- Etter klubbskiftet kontrolleres konsekvensen for Fantasy-klubbgrensen. Dersom et eksisterende lag blir regelstridig utelukkende fordi en spiller bytter klubb, skal Chat 04 avklare og dokumentere håndteringen før ad-hoc endringer gjøres. Historiske snapshots skal aldri endres for å reparere et nåværende klubbgrenseproblem.

## 3. Spiller forlater EHL / er ikke lenger current roster

**Eier: Chat 02 – MP-02.6. Chat 04 kobles inn for Fantasy-konsekvenser.**

- Verifiser avgangen før rosterstatus endres.
- Behold spilleridentitet, kamp-/poenghistorikk og historiske snapshots.
- Spilleren skal normalt stenges for **nye Fantasy-kjøp**, ikke slettes fra historikken.
- Eksisterende lag som allerede eier spilleren skal ikke muteres automatisk uten eksplisitt dokumentert Fantasy-regel. Chat 04 avgjør hvordan brukeren skal kunne/ måtte bytte spilleren ut.
- Låst sesongpris beholdes som historisk økonomifasit.

## 4. Skade, sykdom, suspensjon eller annet fravær

**Eier: Chat 09 – MP-09.**

- Availability-status skal bygge på dokumentert kilde og sikker spilleridentitet.
- Usikker ekstern matching skal ikke automatisk knyttes til en spiller.
- Availability kan påvirke xFP/anbefalinger og admin-optimalisator etter eksisterende modell, men skal ikke omskrive historiske poeng eller snapshots.
- Roster-/identitetsproblem sendes til Chat 02; analysekonsekvens sendes til Chat 08 ved behov.

## 5. Kampdata, HockeyLive eller terminliste

- **Chat 02:** feil/mangler i kampimport, terminliste, kamp-ID, lag-/spilleridentitet, roster eller synk.
- **Chat 06:** kampstatistikken er hentet, men Fantasy-poeng/statistikk/reconciliation ser feil ut.
- **Chat 05:** feil rundeplassering, deadline eller snapshot/freeze.

Feil skal spores til kilden før data korrigeres. Ikke reparer et scoringproblem ved å endre kampdata dersom kampdata faktisk er korrekte, og ikke reparer et importproblem i scoringmotoren.

## 6. Fantasy-regler og brukerlag i drift

- **Chat 04:** lagbygger, permanente transfers, Bytteboost, budsjett, posisjon/klubbgrense, C/VC og brukerlag.
- **Chat 05:** runder, deadlines, flyttede kamper og snapshots.
- **Chat 07:** leaderboard, rundehistorikk, Event Weeks og konkurransepresentasjon.
- **Chat 10:** admin-only lag-/bytteoptimalisering og optimizerlogikk.

## 7. Analyse og anbefalinger

- **Chat 08:** xFP, form, fixture-rating, verdi, kjøp/hold/selg og kapteinsanalyse.
- **Chat 09:** availability-input som påvirker analysen.
- **Chat 10:** optimizer bruker de autoritative inputene; optimizer skal ikke reparere feil i MP-02/08/09-data selv.

## 8. Tipping og miniligaer

**Eier: Chat 13.**

Kamptips, tabelltips, tipping-scoring, awards/streak/statistikk og felles miniliga-medlemskap håndteres her. Underliggende EHL-kamp-/terminlistedatafeil sendes til Chat 02.

## 9. Teknisk produksjonsdrift og incidents

**Eier: Chat 01.**

Vercel, Supabase, auth, RLS, migrations, secrets, cron, HockeyLive-jobber, CI, backups, rollback, observability og tekniske produksjonsincidenter håndteres etter `docs/MP01_PRODUCTION_RUNBOOK.md`.

Ved større incident:

1. Beskytt dataintegritet og historiske snapshots/scoring først.
2. Finn rotårsak før ad-hoc korrigering.
3. Ikke svekk auth/RLS eller testisolasjon for å få systemet opp.
4. Involver domenechatten (02/04/05/06/07/09/13) dersom feilen ligger i forretningslogikken/dataene.
5. Dokumenter korrigering og verifisering på `main`.

## 10. UI/mobil og regresjon

- **Chat 11:** visuelle feil, responsive problemer, navigasjon og UX.
- **Chat 12:** regresjon, datakvalitet, sikkerhetstester og testisolasjon etter produksjonsendringer.

## Hurtigruting

| Hendelse | Primær chat | Sekundær chat ved behov |
|---|---|---|
| Ny EHL-spiller | 02 | 03 → 08/09 |
| Førstegangspris på ny spiller | 03 | 02 |
| Spiller bytter klubb | 02 | 04 |
| Spiller forlater EHL | 02 | 04 |
| Skade/sykdom/suspensjon | 09 | 02/08 |
| Feil roster/spiller-ID | 02 | 12 |
| Feil kampimport/terminliste | 02 | 05/06 |
| Feil Fantasy-poeng/kampstatistikk | 06 | 02/12 |
| Feil deadline/snapshot | 05 | 06/12 |
| Transfer-/lagregelproblem | 04 | 05/12 |
| Leaderboard/Event Week/historikk | 07 | 05/06/12 |
| xFP/anbefaling | 08 | 09/10 |
| Bytte-/lagoptimalisering | 10 | 04/08/09 |
| Tipping/miniliga | 13 | 02/12 |
| UI/mobil/design | 11 | 12 |
| Vercel/Supabase/cron/auth/RLS | 01 | 12 + relevant domenechat |
| Større produksjonsincident | 01 | relevant domenechat |
| Prioritering/tverrgående beslutning | Styringschat | relevant arbeidschat |

---

## Prioritert arbeidskø

Stang Inn er nå i sesongbasert driftsfase.

1. **🔵 Løpende sesongdrift:** MP-02.6 roster-/kampdatasynk, MP-09 availability, MP-13 live-verifisering, cron/sync/CI og produksjonsobservability følges gjennom sesongen.
2. **MP-06.6 – live kampdatavalidering:** gjennomføres i Chat 06 når representative ekte 2026/27-seriekamper finnes. Punktet skal stå åpent til da.
3. **Nye spillere/klubbskifter/avganger:** følg arbeidsflyten i «Sesongdrift 2026/27»; ny spiller går Chat 02 → Chat 03 før kjøpbarhet, klubbskifte/avgang starter i Chat 02.
4. Ved incident brukes `docs/MP01_PRODUCTION_RUNBOOK.md`; dataintegritet og snapshot-/scoringfasit prioriteres foran ad-hoc korrigering.

## Fast handoff mellom arbeidschatter

Når et steg faktisk er ferdig:

- **✅ Ferdig:** `MP-XX.YY – kort navn`.
- **Verifisert:** finnes på `main` + relevante tester/kontroller bestått.
- **➡️ Neste prioritet:** `Chat NN – navn`, `MP-XX.YY – konkret neste oppgave`.
- **Hvorfor nå:** kort forklaring på avhengigheten/prioriteringen.

Hvis arbeidet ikke er på `main`, verifikasjon mangler eller nødvendig manuell SQL gjenstår, skal punktet ikke markeres ferdig.
