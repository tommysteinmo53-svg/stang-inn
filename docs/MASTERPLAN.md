# Stang Inn – MASTERPLAN

> Prosjektets operative kontrollsenter. GitHub `main` er teknisk source of truth. Denne filen gir oversikt, prioritering og sporbarhet.

Sist etablert: 2026-08-16

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
- MP-01.3 🟡 RLS og sikkerhetsmodell finnes og skal regresjonstestes ved nye funksjoner.
- MP-01.4 ✅ Vercel/produksjonsoppsett etablert.
- MP-01.5 🟡 GitHub Actions build-CI finnes; utvides etter behov med sikre tester.
- MP-01.6 ⬜ Samlet produksjons-/driftschecklist før sesongstart.

# MP-02 – EHL-data, terminliste og spilleridentitet

**Status: 🟡**

- MP-02.1 ✅ EHL 2026/27 Tournament ID `448981` etablert.
- MP-02.2 ✅ Terminlisteimport og kampdata etablert.
- MP-02.3 ✅ 2026/27-spillerpool importert og roster-preflight gjennomført.
- MP-02.4 ✅ Roster-gate nådde 244/244 sikre matcher, 0 mangler, 0 tvetydige og 0 lagavvik.
- MP-02.5 🟡 Robust identitetsmatching, duplicate checks og admin-kø finnes; behold sikkerhetsgate ved fremtidige rosterendringer.
- MP-02.6 🔵 Løpende roster- og kampdatasynk gjennom sesongen.

# MP-03 – Fantasypriser og spillerøkonomi

**Status: 🟡**

- MP-03.1 ✅ Historisk pris-/fair-value-grunnlag etablert.
- MP-03.2 ✅ Prismodell v4 og markedskalibrering v4.1 implementert.
- MP-03.3 ✅ Importspillerlogikk v4.2 implementert.
- MP-03.4 ✅ Talent-/importmodell v4.3 implementert.
- MP-03.5 ✅ Pris-publisering og audit-migrasjoner finnes.
- MP-03.6 🟡 Endelig preseason-kalibrering og kvalitetssikring mot faktisk 2026/27-spillerpool.
- MP-03.7 ⬜ Definer policy for eventuelle prisendringer etter sesongstart.

# MP-04 – Lagbygger, regler og brukerlag

**Status: 🟡**

- MP-04.1 ✅ Persistente fantasybrukerlag etablert.
- MP-04.2 ✅ Kaptein og visekaptein støttes.
- MP-04.3 ✅ Klubbbegrensning og sentrale lagvalideringer implementert.
- MP-04.4 🟡 Lagbygger/UI finnes og viderepoleres for mobil og desktop.
- MP-04.5 ⬜ Full transfersyklus: byttebank, frie bytter, eventuelle kostnader og historikk.
- MP-04.6 ⬜ Endelig regelverk for låsing/endring mellom deadlines dokumenteres samlet.
- MP-04.7 ⬜ Vis alle motstandere i aktuell fantasy-gameweek direkte på hver spiller i «Mitt lag»/lagbyggeren. Motstanderne skal vises tydelig under spillerens klubb/posisjon, støtte gameweeks med 0, 1 eller flere kamper per lag og følge den gameweeken laget bygges eller redigeres for.

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

**Status: 🟡 / langt kommet**

- MP-07.1 ✅ Sesong-leaderboard implementert.
- MP-07.2 ✅ Isolert leaderboard E2E-test og testkontroller implementert.
- MP-07.3 ✅ Rundering/rank, bevegelse og egen-lag-markering implementert.
- MP-07.4 🟡 Rundevisning og visuell presentasjon viderepoleres.
- MP-07.5 ⬜ Endelig konkurranse-/premie-/tie-break-regelverk dokumenteres dersom nødvendig.
- MP-07.6 ⬜ **Bonus Weeks / fantasy-boostere:** utred og innfør utvalgte gameweeks der brukerne kan hente ekstra poeng gjennom strategiske bonusmekanikker. Hent dokumentert inspirasjon fra etablerte fantasyspill og vurder blant annet modeller som ekstra kapteinsmultiplikator, midlertidige lag-/byttefordeler eller andre begrensede boostere. Definer hvilke bonusmekanikker Stang Inn skal bruke, hvor ofte de kan brukes/aktiveres, om de er brukerinitierte eller knyttet til bestemte gameweeks, hvordan de samspiller med runder/deadlines/snapshots/scoring, og hvordan de presenteres tydelig i UI. Reglene skal være forståelige, balanserte og testbare før implementering.

# MP-08 – Analyse, xFP og anbefalinger

**Status: 🟡**

- MP-08.1 🟡 Analysemodul/admin finnes.
- MP-08.2 🟡 Preseason xFP-baseline og preview er implementert og optimalisert.
- MP-08.3 🟡 Ekstern preseason-data kan parses sikkert med preview/approval før bruk.
- MP-08.4 ⬜ Form 3/5/10, hjemme/borte og verdi per million ferdigstilles som konsistente analysefeatures.
- MP-08.5 ⬜ Fixture-/motstanderrating ferdigstilles.
- MP-08.6 ⬜ Kjøp / hold / selg-score.
- MP-08.7 ⬜ Kapteinscore/anbefaling.
- MP-08.8 ⬜ Forventede poeng neste kamp / runde / tre runder med forklaring.

# MP-09 – Skader, fravær og tilgjengelighet

**Status: 🟡 – kilde/matching ferdig, analyseintegrasjon gjenstår**

- MP-09.1 ✅ Datamodell for spiller-tilgjengelighet etablert.
- MP-09.2 ✅ Admin-API og admin-side for tilgjengelighet etablert.
- MP-09.3 ✅ Status for «ikke i kamptropp» støttes.
- MP-09.4 ✅ Dokumentert kildeinnhenting etablert: allowlistede EHL-klubbsider og nitten.no med freshness-gate/deduplisering, samt HockeyLive MatchTeamMembers-kontroll for preseason og ordinære 2026/27-kamper. Eksterne funn legges kun i review-kø og publiseres aldri automatisk.
- MP-09.5 ✅ Sikker roster-matching og adminverifisering etablert. Usikre/tvetydige funn krever manuell kontroll; godkjenning verifiserer aktiv roster-spiller og oppdaterer availability + historikk + funnstatus atomisk.
- MP-09.6 ⬜ Koble kun admin-godkjent tilgjengelighet inn i xFP, anbefalinger og optimalisator. Ikke-godkjente kildefunn skal aldri påvirke modellen.
- MP-09.7 ⬜ Varsler for relevante spillere på analyserte fantasy-lag.

# MP-10 – Lagoptimalisator

**Status: ⬜**

- MP-10.1 ⬜ Input: nåværende lag, budsjett, maks bytter og låste spillere.
- MP-10.2 ⬜ Output: anbefalte UT/IN og ny lagverdi.
- MP-10.3 ⬜ Forventet poenggevinst og risiko.
- MP-10.4 ⬜ Konservativt og offensivt alternativ.
- MP-10.5 ⬜ Ta hensyn til tilgjengelighet, fixture og xFP.

# MP-11 – UI/UX og mobilopplevelse

**Status: 🟡**

- MP-11.1 🟡 Felles fantasy-navigasjon og adminstruktur finnes.
- MP-11.2 🟡 Leaderboard er polert for desktop/mobil.
- MP-11.3 🟡 Lagbygger, runder, spillerkort og analyse gjennomgås systematisk for mobil.
- MP-11.4 ⬜ Samlet UX-pass før lansering.
- MP-11.5 ⬜ Tilgjengelighet/readability/loading/error/empty states kvalitetssikres.

# MP-12 – Testing, sikkerhet og datakvalitet

**Status: 🟡 / kontinuerlig**

- MP-12.1 ✅ Build-CI på push/PR til main.
- MP-12.2 ✅ Isolerte E2E-verktøy finnes for sentrale snapshot- og leaderboard-flyter.
- MP-12.3 🟡 Utvid regresjonsdekning for scoring, transfers, deadlines, RLS og admin.
- MP-12.4 🔵 Ingen test skal endre ekte 2026/27-data.
- MP-12.5 🔵 Nye tester skal rydde opp egne data.
- MP-12.6 🔵 Ikke svekk auth/RLS/sikkerhet for testbarhet.
- MP-12.7 ⬜ Pre-launch full regresjonstest.

# MP-13 – Stang Inn tipping

**Status: 🟡 separat produktspor**

- MP-13.1 🟡 Kamptips og EHL-synk er under utvikling/etablert i deler.
- MP-13.2 🟡 Tabelltips.
- MP-13.3 ⬜ Automatisk poengberegning ferdigstilles og produksjonsverifiseres.
- MP-13.4 ⬜ Månedsvinner, streak, poenggrafer, Ukens bom, Eksperttittel og øvrige awards ferdigstilles.
- MP-13.5 ⬜ Mobil-/brukerflyt og sesongklar testing.

# MP-14 – Lansering EHL 2026/27

**Status: ⬜**

- MP-14.1 ⬜ Lås og publiser endelig fantasyregelverk.
- MP-14.2 ⬜ Verifiser spillerpool, lag, posisjoner og priser.
- MP-14.3 ⬜ Verifiser alle 45 runder/deadlines mot terminlisten.
- MP-14.4 ⬜ Full scoring-/snapshot-/leaderboard-regresjon.
- MP-14.5 ⬜ Verifiser produksjonsmiljø, cron/synk og secrets.
- MP-14.6 ⬜ Mobil/desktop smoke test.
- MP-14.7 ⬜ Backup/rollback/admin-rutiner.
- MP-14.8 ⬜ GO LIVE.

---

## Prioritert arbeidskø

Dette er den operative standardrekkefølgen. Køen skal vurderes på nytt når et steg er ferdig, blokkert eller når ny informasjon endrer avhengighetene. Arbeidschatten som fullfører et steg skal lese siste versjon av denne køen på `main` før den sender brukeren videre.

1. **Chat 08 – MP-08.2 + MP-08.3 + MP-08.4 + MP-08.5: preseason/form og analysegrunnlag.** Fortsett treningskampdata, preseason-form, formfeatures og fixture-/motstanderrating på et stabilt datagrunnlag. Dette er nå neste aktive spor etter ferdigstilt MP-09.4/09.5.
2. **Chat 09 → Chat 08 – MP-09.6: availability inn i xFP/anbefalinger.** Når analysegrunnlaget er stabilt, skal kun admin-godkjent fravær påvirke forventede poeng og analyser; usikre kildefunn skal ikke gjøre det.
3. **Chat 03 – MP-03.6: endelig preseason-kalibrering av priser.** Gjennomfør siste kvalitetssikring mot faktisk 2026/27-pool når preseason-grunnlaget er modent nok.
4. **Chat 04 – MP-04.7: motstandere i aktuell gameweek på «Mitt lag».** Gjør kommende kamper tydelige for hver spiller, inkludert 0/1/flere kamper.
5. **Chat 07 – MP-07.6: Bonus Weeks / fantasy-boostere.** Undersøk andre fantasyspill, velg Stang Inn-modell og lås prinsippene før transfersystem og endelig regelverk ferdigstilles dersom bonusmekanikkene påvirker bytter, scoring eller deadlines.
6. **Chat 04 – MP-04.5 + MP-04.6: full transfersyklus og endelige låseregler.** Byttebank, frie bytter, kostnader/historikk og samspill med eventuelle boostere.
7. **Chat 08 – MP-08.6 + MP-08.7 + MP-08.8: beslutningsstøtte.** Kjøp/hold/selg, kapteinscore og forventede poeng for neste kamp/runde/tre runder.
8. **Chat 10 – MP-10: lagoptimalisator.** Bygg først når pris, fixture, xFP og availability er stabile input.
9. **Chat 07 + Chat 11 – MP-07.4/07.5 og MP-11.3–11.5: konkurransepresentasjon og samlet UX-pass.** Rundevisning, regler, mobil/desktop, readability og states.
10. **Chat 12 – MP-12.3 + MP-12.7: bred regresjon og pre-launch kvalitet.** Scoring, transfers, deadlines, RLS, admin og sentrale brukerflyter.
11. **Chat 01 + Chat 14 – MP-01.6 og MP-14.1–14.7: produksjons- og launch-gate.** Regelverk, 45 runder/deadlines, produksjon, cron/secrets, smoke tests, backup og rollback.
12. **Chat 14 – MP-14.8: GO LIVE** når alle kritiske launch-gates er PASS.

**Sesongavhengig:** MP-06.6 full produksjonsvalidering mot faktiske 2026/27-kamper gjennomføres i **Chat 06** så snart representative seriekamper finnes. MP-02.6 og øvrig synk/datadrift fortsetter løpende. **Chat 13 / MP-13** er et separat tipping-spor som kan utvikles parallelt så lenge det ikke blokkerer Fantasy XI-kritisk arbeid.

## Fast handoff mellom arbeidschatter

Når et steg faktisk er ferdig skal arbeidschatten avslutte omtrent slik:

- **✅ Ferdig:** `MP-XX.YY – kort navn`.
- **Verifisert:** finnes på `main` + relevante tester/kontroller bestått.
- **➡️ Neste prioritet:** `Chat NN – navn`, `MP-XX.YY – konkret neste oppgave`.
- **Hvorfor nå:** én kort forklaring på avhengigheten/prioriteringen.

Hvis arbeidet **ikke** er på `main`, relevante tester ikke er bestått, eller nødvendig manuell SQL/verifisering gjenstår, skal chatten ikke skrive «ferdig» og ikke sende videre som om punktet er ✅.

Hvis et steg blir blokkert, skal arbeidschatten identifisere hvilken chat/MP som må løse blokkeringen først, og masterplanens prioriteringskø skal oppdateres dersom dette endrer den mest effektive rekkefølgen.

## Foreslått ChatGPT-prosjektstruktur

- `00 – MASTERPLAN` – kun roadmap/status/prioritering
- `01 – Plattform, Supabase & sikkerhet` – MP-01 + relevante deler av MP-12
- `02 – EHL-data & spilleridentitet` – MP-02
- `03 – Prismodell & spillerøkonomi` – MP-03
- `04 – Lagbygger & transfers` – MP-04
- `05 – Runder, deadlines & snapshots` – MP-05
- `06 – Scoring & kampstatistikk` – MP-06
- `07 – Leaderboard & konkurranse` – MP-07
- `08 – Analyse, xFP & anbefalinger` – MP-08
- `09 – Skader & tilgjengelighet` – MP-09
- `10 – Lagoptimalisator` – MP-10
- `11 – UI/UX & mobil` – MP-11
- `12 – Testing & kvalitet` – MP-12
- `13 – Stang Inn tipping` – MP-13
- `14 – Lansering 2026/27` – MP-14

## Synk mellom chat og GitHub

Ved avslutning av et hovedsteg:

1. Verifiser at endringen faktisk finnes på `main`.
2. Verifiser relevante tester/kontroller.
3. Oppdater status i denne masterplanen.
4. Oppdater `docs/PROJECT_STATUS.md` med kort teknisk status dersom arkitektur, drift eller produksjonsstatus er endret.
5. Les den oppdaterte **Prioritert arbeidskø** på `main`.
6. Gi brukeren eksplisitt handoff til neste chat og MP-punkt.
7. Gå først deretter videre til neste MP-punkt.
