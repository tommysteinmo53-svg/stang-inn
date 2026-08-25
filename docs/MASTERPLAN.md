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

**Status: 🟡 / identitetsgrunnlag ferdig**

- MP-01.1 ✅ Next.js / React / TypeScript-applikasjon etablert.
- MP-01.2 ✅ Supabase og innlogging etablert.
- MP-01.3 🟡 RLS og sikkerhetsmodell finnes og regresjonstestes ved nye funksjoner. MP-12 pre-launch-audit har verifisert sentrale Fantasy-sikkerhetsgater.
- MP-01.4 ✅ Vercel/produksjonsoppsett etablert.
- MP-01.5 ✅ GitHub Actions build-CI inkluderer MP-12 scoring/security/test-isolation, MP-13 scoring/readiness/felles miniligaer, MP-04 transfer, Bonus Weeks, MP-07 historikk/stats/identitet/Event Weeks og MP-10 optimizer før build.
- MP-01.6 ⬜ Samlet produksjons-/driftschecklist før sesongstart.
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

# MP-11 – UI/UX og mobilopplevelse

**Status: ✅ samlet UX-pass / ⬜ redesigndesignvalg og merkevareimplementasjon gjenstår**

- MP-11.1–MP-11.7 ✅ Navigasjon, Fantasy-/tippingflater, mobil, states og samlet UX-polering er implementert.
- MP-11.8 ⬜ **Stang Inn-redesign, logo og visuell merkevare:** Før kodeimplementasjon skal Chat 11 lage **tre konkrete, tydelig forskjellige forslag til en komplett redesignet Stang Inn-side/design**, alle med den nye Stang Inn-logoen integrert. Forslagene skal visualisere en realistisk helhetlig desktopside og beskrive hvordan samme designsystem tilpasses mobil. De tre retningene skal sammenlignes på navigasjon, informasjonsarkitektur, Fantasy/Tipping/miniliga-presentasjon, Event Weeks, leaderboard, typografi, farger, kort/panelstil, tetthet, hockeyidentitet og brukervennlighet. Minst ett forslag skal være en videreutvikling av dagens løsning, minst ett skal være et tydelig sports-dashboard, og minst ett kan være en mer særpreget/premium redaksjonell hockeyretning. **Ingen full redesign skal implementeres før brukeren eksplisitt har valgt/godkjent én retning eller en kombinasjon av elementer fra forslagene.** Etter designvalget skal valgt retning gjøres produksjonsklar med hovedlogo-/SI-ikonassets, header/navigasjon, favicon/metadata og app-/PWA-ikoner, og implementeres konsistent på relevante Stang Inn-flater uten å miste eksisterende funksjonalitet. Verifiser mobil/desktop, lesbarhet, responsive states og produksjonsbuild. Endelige assets skal ligge i repoet; produksjonen skal ikke avhenge av midlertidige chat-/preview-filer.

# MP-12 – Testing, sikkerhet og datakvalitet

**Status: ✅ pre-launch-regresjon gjennomført / 🔵 må kjøres igjen etter nye identitets/Event Week-endringer**

- MP-12.1–MP-12.7 ✅/🔵 CI, isolerte E2E-gater, sikkerhet og bred pre-launch-regresjon er etablert. Ingen test skal endre ekte 2026/27-data.
- Ny sluttpass skal inkludere MP-01.7, MP-04.8, MP-07.10–07.12, MP-11.8 og MP-13.6 før launch-gate.

# MP-13 – Stang Inn tipping

**Status: ✅ preseasonklar kjerne + felles miniligaer / 🔵 live-verifisering gjennom sesongen**

- MP-13.1–MP-13.5 ✅ Kamptips, tabelltips, automatisk scoring, awards/statistikk og sesongklar brukerflyt er implementert; live-verifisering fortsetter på reelle sesongdata.
- MP-13.6 ✅ **Felles miniligaer på tvers av Tipping og Fantasy:** én kanonisk `stang_inn_private_leagues` + `stang_inn_private_league_members`-modell er produksjonsmigrert fra begge legacy-produktene uten tap av liga-ID, invitasjonskode, eier, medlemskap eller `joined_at`. Legacy-tabellene beholdes som immutable migreringshistorikk, mens gamle Fantasy-/Tipping-RPC-er er kompatibilitetswrappere mot den kanoniske modellen. Create/join/list/leave og medlemskontroll er authenticated-only; `anon` har ikke EXECUTE, og vanlige klientroller har ingen direkte tabelltilgang. Ligaeier er ligadmin og kan ikke forlate ligaen; ordinær utmelding fjerner medlemskapet fra begge produkter og rejoin via samme invitasjonskode gjenoppretter begge. `/leagues` er felles brukerflate med Tipping-/Fantasy-faner; gamle `/fantasy/leagues`-ruter redirecter dit. Fantasy-tabellen filtrerer den autoritative `get_fantasy_competition_table_v2` og beholder tie-break totalpoeng → rundeseire → beste runde, med Fantasy-lagnavn + bekreftet profilnavn. Tipping-tabellen beholder eksisterende 5/3/0- og poeng → eksakte → riktige utfall-logikk med Stang Inn-profilnavn. Ingen e-post/private profilfelt eksponeres. Rollback-only behavioral produksjonstest verifiserte Fantasy-create → Tipping-synlighet, Tipping-join → Fantasy-synlighet, separate standings med samme medlemmer, leave/rejoin, owner-sperre og 0 testrester. MP-13.6-regresjon er koblet til CI og Vercel-build er grønn 2026-08-24.

# MP-14 – Lansering EHL 2026/27

**Status: ⬜**

- MP-14.1 ⬜ Lås og publiser endelig fantasyregelverk.
- MP-14.2 ⬜ Verifiser spillerpool, lag, posisjoner og priser.
- MP-14.3 ⬜ Verifiser alle 45 runder/deadlines mot terminlisten.
- MP-14.4 ⬜ Full scoring-/snapshot-/leaderboard-regresjon.
- MP-14.5 ⬜ Verifiser produksjonsmiljø, cron/synk og secrets.
- MP-14.6 ⬜ Mobil/desktop smoke test inkludert endelig branding/redesign.
- MP-14.7 ⬜ Backup/rollback/admin-rutiner.
- MP-14.8 ⬜ GO LIVE.

---

## Prioritert arbeidskø

Dette er den operative standardrekkefølgen. Køen skal vurderes på nytt når et steg er ferdig eller når nye avhengigheter oppstår.

1. **Chat 11 – MP-11.8: tre redesignforslag → designvalg → implementer Stang Inn-logo og valgt merkevareretning.** Chat 11 skal først levere tre konkrete, tydelig forskjellige komplette designforslag med logo inkludert og sammenligne styrker/svakheter. Ingen full redesign implementeres før brukeren velger/godkjenner retning. Deretter gjøres valgt designsystem, logo, SI-ikon, header, favicon/metadata og app-/PWA-assets produksjonsklare og implementeres før endelig launch-smoke.
2. **Chat 12 – MP-12.3 + MP-12.7: ny bred sluttregresjon etter identitets-/miniliga-/Event Week-/redesignendringene.** Ta med profilnavn, lagnavn, tabellvisning, felles miniliga-RLS, alle Event Weeks og valgt MP-11.8-design/branding.
3. **Chat 01 + Chat 14 – MP-01.6 og MP-14.1–14.7: produksjons- og launch-gate.**
4. **Chat 14 – MP-14.8: GO LIVE** når alle kritiske gates er PASS.

**Sesongavhengig:** MP-06.6 gjennomføres i Chat 06 når representative 2026/27-seriekamper finnes. MP-02.6 og MP-09 fortsetter løpende. MP-13 live-verifiseres på reelle sesongdata.

## Fast handoff mellom arbeidschatter

Når et steg faktisk er ferdig:

- **✅ Ferdig:** `MP-XX.YY – kort navn`.
- **Verifisert:** finnes på `main` + relevante tester/kontroller bestått.
- **➡️ Neste prioritet:** `Chat NN – navn`, `MP-XX.YY – konkret neste oppgave`.
- **Hvorfor nå:** kort forklaring på avhengigheten/prioriteringen.

Hvis arbeidet ikke er på `main`, verifikasjon mangler eller nødvendig manuell SQL gjenstår, skal punktet ikke markeres ferdig.