# Stang Inn – MASTERPLAN

> Prosjektets operative kontrollsenter. GitHub `main` er teknisk source of truth. Denne filen gir oversikt, prioritering og sporbarhet.

Sist oppdatert: 2026-08-24

## Arbeidsregler

- Før kodeendringer: kontroller alltid faktisk status på `main`.
- Ett hovedpunkt om gangen: status → plan → implementering → test → verifisering → ferdig.
- Et punkt markeres ikke ferdig før implementasjonen finnes på `main` og er verifisert.
- Isolerte E2E-tester skal aldri endre ekte 2026/27-data og skal rydde opp egne testdata.
- Auth/RLS/sikkerhet skal ikke svekkes for å få tester til å fungere.
- Hvis Supabase-SQL må kjøres manuelt: gi én komplett SQL-blokk, vent på resultat, verifiser, fortsett deretter.
- Arbeidschatter kan diskutere detaljer; masterplan-chatten skal holdes kort og oppdatert.
- Ved ferdigstillelse av et avgrenset steg skal arbeidschatten kontrollere siste `main` og gjeldende prioriteringskø i denne filen før den anbefaler neste steg. Neste chat skal ikke gjettes ut fra gammel samtalekontekst.
- Hver ferdigstilt arbeidsøkt skal avsluttes med en tydelig handoff: hva som er ferdig/verifisert, hvilken chat som er neste, hvilket MP-punkt som skal tas der, og hvorfor dette er neste effektive steg.

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

**Status: 🟡**

- MP-01.1 ✅ Next.js / React / TypeScript-applikasjon etablert.
- MP-01.2 ✅ Supabase og innlogging etablert.
- MP-01.3 🟡 RLS og sikkerhetsmodell finnes og skal regresjonstestes ved nye funksjoner. MP-12 pre-launch-audit har verifisert 0 anon-kjørbare Fantasy `SECURITY DEFINER`-funksjoner og hardnet identifiserte bypass-/diagnostikkflater.
- MP-01.4 ✅ Vercel/produksjonsoppsett etablert.
- MP-01.5 ✅ GitHub Actions build-CI inkluderer MP-12 scoring-, security- og test-isolation-gater, MP-13 scoring/readiness, MP-04 transfer, Bonus Weeks, MP-07 rundehistorikk/stats og MP-10 optimizer før full build.
- MP-01.6 ⬜ Samlet produksjons-/driftschecklist før sesongstart.

# MP-02 – EHL-data, terminliste og spilleridentitet

**Status: ✅ preseason-spillerpool verifisert / 🔵 løpende drift**

- MP-02.1 ✅ EHL 2026/27 Tournament ID `448981` etablert.
- MP-02.2 ✅ Terminlisteimport og kampdata etablert.
- MP-02.3 ✅ Preseason-spillerpool korrigert og produksjonsverifisert mot EliteProspects som autoritativ preseason-fasit.
- MP-02.4 ✅ Full roster-gate: 239/239 matchet, 0 mangler, 0 tvetydige, 0 lagavvik, 0 ekstra og 0 posisjonsavvik. 0 duplikate external IDs og 0 ikke-kanoniske current-roster-lagverdier.
- MP-02.5 ✅ Robust identitetsmatching, duplicate checks, reviewed aliases og admin-audit finnes. TeamMembers-fallback fra HockeyLive skal ikke behandles som autoritativ preseason-roster. Usikre identiteter skal fortsatt kreve eksplisitt kontroll.
- MP-02.6 🔵 Løpende roster- og kampdatasynk gjennom sesongen. HockeyLive brukes for kamp-/ID-data; EP-verifiserte provisoriske `ep:`-identiteter oppgraderes eksplisitt til NIF når sikker ID foreligger.

# MP-03 – Fantasypriser og spillerøkonomi

**Status: ✅ preseason-priser ferdigkalibrert / ⬜ post-start prispolicy gjenstår**

- MP-03.1 ✅ Historisk pris-/fair-value-grunnlag etablert.
- MP-03.2 ✅ Prismodell v4 og markedskalibrering v4.1 implementert.
- MP-03.3 ✅ Importspillerlogikk v4.2 implementert.
- MP-03.4 ✅ Talent-/importmodell v4.3 implementert.
- MP-03.5 ✅ Pris-publisering og audit-migrasjoner finnes.
- MP-03.6 ✅ Endelig preseason-kalibrering og kvalitetssikring mot faktisk 2026/27-spillerpool er publisert som V4.6.2 og produksjonsverifisert. 239/239 current-roster-spillere har pris og låst sesongpris, 239/239 er kjøpbare, nøyaktig 14 godkjente prisendringer ble publisert, 0 prislag-avvik, 0 stale `purchase_price` og 0 eksisterende lag over 100m. Kalibreringen endret ikke fantasy-scoring og brukte historikk/modelløkonomi som hovedgrunnlag; analyse/xFP var kontrollsignal, ikke ny prismotor.
- MP-03.7 ⬜ Definer policy for eventuelle prisendringer etter sesongstart.

# MP-04 – Lagbygger, regler og brukerlag

**Status: ✅ transfer-/regelkjernen og brukerflaten ferdigstilt / 🔵 sesongvedlikehold**

- MP-04.1 ✅ Persistente fantasybrukerlag etablert.
- MP-04.2 ✅ Kaptein og visekaptein støttes.
- MP-04.3 ✅ Klubbbegrensning og sentrale lagvalideringer implementert.
- MP-04.4 ✅ Lagbygger/UI er sluttpolert for mobil og desktop gjennom MP-11. Touch targets, spiller-/fixturehierarki, Eventlag og Bytter er harmonisert uten å endre lag- eller transferlogikk.
- MP-04.5 ✅ Full transfersyklus er ferdigstilt og dokumentert: fast maks 2 permanente spillerbytter per ordinær fantasy-runde uten byttebank og uten poengtrekk; Bytteboost øker grensen til 4 i valgt runde og låses når lagret transferbruk passerer 2. Transfers teller først ved serverlagring, lagrede bytter refunderes ikke, og transferledger lagrer batch, runde, tidspunkt, lagverdi før/etter og alle INN/UT-spillere med pris. Egen brukerflate `/fantasy/transfers` viser reglene og historikken via autentisert read-only RPC. Rik/Fattig Onkel bruker separate eventlag og skriver aldri permanent transferhistorikk.
- MP-04.6 ✅ Endelig låseregelverk er dokumentert i `docs/FANTASY_TRANSFER_RULES.md`: transfers gjelder neste åpne autoritative fantasy-runde og må skje før deadline; rekke, kaptein, visekaptein og lagnavn teller ikke som transfer; Event Weeks sperrer permanente transfers; snapshot ved deadline er historisk fasit og senere transfers kan ikke endre historiske runder. Server-side validering for deadline, snapshot, budsjett, posisjoner, klubbgrense, Bytteboost og Event Week beholdes som autoritativ gate.
- MP-04.7 ✅ Motstandere i aktuell fantasy-gameweek vises direkte på hver spiller i «Mitt lag»/lagbyggeren. Løsningen gjenbruker `fantasy_rounds` og autoritativ `get_fantasy_round_schedule_v1`, bruker felles klubbnormalisering, viser H/B og håndterer 0, 1 eller flere kamper uten å endre scoring, deadlines eller rundedefinisjoner. Produksjonsdata og grønn Vercel-build er verifisert 2026-08-22.

# MP-05 – Fantasy-runder, deadlines og snapshots

**Status: ✅ kjerne implementert**

- MP-05.1 ✅ Kalenderbaserte fantasy-runder etablert.
- MP-05.2 ✅ Flyttede kamper følger faktisk kampdato.
- MP-05.3 ✅ Deadline knyttes til første kampstart i fantasy-runden.
- MP-05.4 ✅ Deadline-sikre lag-snapshots implementert.
- MP-05.5 ✅ Snapshot readiness/freeze-kontroller implementert.
- MP-05.6 ✅ Isolerte snapshot E2E-verktøy/testkontroller implementert.
- MP-05.7 🔵 Regresjonstest ved endringer i runde-/deadline-logikk.

# MP-06 – Fantasy scoring og kampstatistikk

**Status: 🟡**

- MP-06.1 ✅ Fantasy-poengmotor og spiller-kampstatistikk etablert.
- MP-06.2 ✅ Special-teams scoring støttes.
- MP-06.3 ✅ Forward-flex/faceoff-relatert logikk er migrert inn.
- MP-06.4 ✅ Kaptein ×2 og visekaptein ×1,5 er implementert og testet.
- MP-06.5 🟡 Keeperlogikk, shutout/reconciliation og datakvalitet finnes og skal fortsatt overvåkes mot ekte kamper.
- MP-06.6 ⬜ Full produksjonsvalidering mot et representativt sett faktiske 2026/27-kamper når serien starter.

# MP-07 – Leaderboard, rundesider og konkurranse

**Status: ✅ kjerne, historikk, stats og konkurransepresentasjon ferdigstilt / 🔵 sesongdata fylles løpende**

- MP-07.1–MP-07.9 ✅ Leaderboard, runder, tie-break, Bonus/Event Weeks, rundehistorikk og personlig statistikkdashboard er implementert og verifisert. Detaljert status og testspor finnes i tidligere masterplanversjoner og relevante docs/CI-gater.

# MP-08 – Analyse, xFP og anbefalinger

**Status: ✅ – analyseinput og fixture-rating er produksjonsverifisert og stabilt grunnlag for anbefalinger/optimizer**

- MP-08.1–MP-08.8 ✅ Analyse-command-center, xFP, form/verdi, fixture-rating, kjøp/hold/selg, kapteinscore og horisonter er implementert og produksjonsverifisert. Preseason-FP-modellen er bevisst avviklet fordi datagrunnlaget var for ustabilt; ordinære EHL-data er autoritativt grunnlag videre.

# MP-09 – Skader, fravær og tilgjengelighet

**Status: ✅ kjerne produksjonsverifisert / 🔵 reelle funn overvåkes gjennom sesongen**

- MP-09.1–MP-09.7 ✅ Availability-datamodell, admin/review, dokumentert kildeinnhenting, sikker roster-matching, xFP/optimizer-effekt og varsling er implementert og verifisert. Reelle funn følges løpende.

# MP-10 – Lagoptimalisator

**Status: ✅ – komplett adminverktøy implementert og produksjonsverifisert 2026-08-23**

- MP-10.1–MP-10.5 ✅ Komplett optimizer med lag/budsjett/transferstatus/låste spillere, UT→INN, xFP-gevinst/risiko, tre strategier, availability/fixture og autoritative transferregler er implementert og produksjonsverifisert.

# MP-11 – UI/UX og mobilopplevelse

**Status: ✅ samlet Fantasy UX-/mobilpass ferdigstilt 2026-08-23 / ✅ tipping-UX preseasonpolert 2026-08-24 / ⬜ visuell merkevareimplementasjon gjenstår**

- MP-11.1–MP-11.7 ✅ Navigasjon, leaderboard, Fantasy-flater, samlet UX-pass, states og tipping-polering er implementert og verifisert.
- MP-11.8 ⬜ **Stang Inn-logo og visuell merkevareimplementasjon:** implementer den godkjente logo-retningen med en full hovedlogo og en forenklet ikonvariant. Hovedlogoen skal kommunisere Stang Inn som hockey-, fantasy- og tippingprodukt og fungere på både lys og mørk bakgrunn. Den forenklede varianten skal være tydelig og gjenkjennelig i svært små størrelser og brukes som favicon/nettleserfane, app-/PWA-ikon og andre kompakte flater. Lever/implementer nødvendige webvennlige varianter med transparent bakgrunn der det er hensiktsmessig, skalerbare assets der mulig og riktige favicon/app-icon-størrelser. Oppdater metadata/favicon slik at dagens generiske ChatGPT/standardikon erstattes av Stang Inn-identiteten. Logoen skal også integreres konsistent i Stang Inn-header/navigasjon uten å forringe mobilplass, lesbarhet eller eksisterende funksjonalitet. Kontroller både mobil og desktop, lys/mørk kontekst, favicon i nettleserfane og produksjonsbuild. Endelig implementerte assets skal lagres i repoet med tydelig filstruktur; ikke baser produksjonen på en midlertidig chat-/preview-fil. Den godkjente konseptretningen er mørk marine/hvit/gull, hockeypuck/skjold for hovedlogo og en kompakt `SI`-identitet for ikonvarianten.

# MP-12 – Testing, sikkerhet og datakvalitet

**Status: ✅ pre-launch regresjon ferdigstilt 2026-08-24 / 🔵 kontinuerlig kvalitetsgate**

- MP-12.1–MP-12.7 ✅/🔵 CI, isolerte E2E-gater, bred regresjon, testisolasjon, sikkerhet og full pre-launch-regresjon er etablert. Ingen test skal endre ekte 2026/27-data, testdata skal ryddes og auth/RLS skal ikke svekkes.

# MP-13 – Stang Inn tipping

**Status: ✅ preseasonklar kjerne og brukerflyt / 🔵 live-verifisering gjennom sesongen**

- MP-13.1–MP-13.5 ✅ Kamptips/EHL-synk, tabelltips, automatisk scoring, awards/statistikk og sesongklar mobil-/brukerflyt er implementert. Live-verifisering fortsetter på reelle sesongdata.

# MP-14 – Lansering EHL 2026/27

**Status: ⬜**

- MP-14.1 ⬜ Lås og publiser endelig fantasyregelverk.
- MP-14.2 ⬜ Verifiser spillerpool, lag, posisjoner og priser.
- MP-14.3 ⬜ Verifiser alle 45 runder/deadlines mot terminlisten.
- MP-14.4 ⬜ Full scoring-/snapshot-/leaderboard-regresjon.
- MP-14.5 ⬜ Verifiser produksjonsmiljø, cron/synk og secrets.
- MP-14.6 ⬜ Mobil/desktop smoke test, inkludert MP-11.8 logo/favicon/brand assets når dette er ferdig.
- MP-14.7 ⬜ Backup/rollback/admin-rutiner.
- MP-14.8 ⬜ GO LIVE.

---

## Prioritert arbeidskø

Dette er den operative standardrekkefølgen. Køen skal vurderes på nytt når et steg er ferdig, blokkert eller når ny informasjon endrer avhengighetene. Arbeidschatten som fullfører et steg skal lese siste versjon av denne køen på `main` før den sender brukeren videre.

1. **Chat 11 – MP-11.8: implementer Stang Inn-logo og merkevareassets.** Gjør den godkjente hovedlogo-/SI-ikonretningen produksjonsklar, legg assets i repoet, oppdater header, favicon/metadata og app-/PWA-ikoner, og verifiser mobil/desktop + produksjonsbuild. Dette gjøres før launch-gaten slik at den endelige smoke-testen kontrollerer faktisk lanseringsidentitet.
2. **Chat 01 + Chat 14 – MP-01.6 og MP-14.1–14.7: produksjons- og launch-gate.** MP-12.3 + MP-12.7 og MP-13 preseason readiness er ferdig; verifiser endelig regelverk, 45 runder/deadlines, produksjonsmiljø, cron/synk/secrets, mobil/desktop smoke tests samt backup/rollback før GO LIVE.
3. **Chat 14 – MP-14.8: GO LIVE** når alle kritiske launch-gates er PASS.

**Sesongavhengig:** MP-06.6 full produksjonsvalidering mot faktiske 2026/27-kamper gjennomføres i **Chat 06** så snart representative seriekamper finnes. MP-02.6 og øvrig synk/datadrift fortsetter løpende. MP-09 følger nye reelle availability-funn gjennom sesongen. MP-13 følges videre som 🔵 live-verifisering på reelle sesongdata.

## Fast handoff mellom arbeidschatter

Når et steg faktisk er ferdig skal arbeidschatten avslutte omtrent slik:

- **✅ Ferdig:** `MP-XX.YY – kort navn`.
- **Verifisert:** finnes på `main` + relevante tester/kontroller bestått.
- **➡️ Neste prioritet:** `Chat NN – navn`, `MP-XX.YY – konkret neste oppgave`.
- **Hvorfor nå:** én kort forklaring på avhengigheten/prioriteringen.
