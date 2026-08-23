# Stang Inn – MASTERPLAN

> Prosjektets operative kontrollsenter. GitHub `main` er teknisk source of truth. Denne filen gir oversikt, prioritering og sporbarhet.

Sist oppdatert: 2026-08-23

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
- MP-01.5 🟡 GitHub Actions build-CI finnes; Bonus Weeks-, MP-04 transfer- og MP-10 optimizerregresjon kjører før build og videre testdekning utvides etter behov.
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

**Status: ✅ transfer-/regelkjernen ferdigstilt / 🟡 videre UI-polering**

- MP-04.1 ✅ Persistente fantasybrukerlag etablert.
- MP-04.2 ✅ Kaptein og visekaptein støttes.
- MP-04.3 ✅ Klubbbegrensning og sentrale lagvalideringer implementert.
- MP-04.4 🟡 Lagbygger/UI finnes og viderepoleres for mobil og desktop.
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

**Status: 🟡 / langt kommet**

- MP-07.1 ✅ Sesong-leaderboard implementert.
- MP-07.2 ✅ Isolert leaderboard E2E-test og testkontroller implementert.
- MP-07.3 ✅ Rundering/rank, bevegelse og egen-lag-markering implementert.
- MP-07.4 🟡 Rundevisning og visuell presentasjon viderepoleres.
- MP-07.5 ⬜ Endelig konkurranse-/premie-/tie-break-regelverk dokumenteres dersom nødvendig.
- MP-07.6 ✅ **Bonus Weeks / fantasy-boostere:** komplett regel-, data-, scoring-, transfer-, snapshot-, UI- og historikksystem er implementert og produksjonsverifisert 2026-08-23. Hvert lag har én Kapteinsboost (C ×2,5), én Rekkeboost (rekke 2 = 100 %) og én Bytteboost (opptil 4 bytter) per sesong, maks ett personlig kort per runde og eksisterende deadline som aktiverings-/låsegrense. Felles Event Weeks er **Rik Onkel** med separat 200m-lag og **Fattig Onkel** med separat 70m-lag; eventlag påvirker aldri permanent 100m-lag eller ordinær transferhistorikk. Personlige kort er sperret i Event Weeks. Booster/eventmetadata fryses i snapshot og brukes av autoritativ scoring/historikk. Double gameweeks støttes ved at alle kamp-poeng i runden summeres før multiplikatorer. Leaderboardets utfoldbare rundehistorikk viser booster/eventmarkører. Schema-mismatch oppdaget under verifikasjon ble reparert mot faktisk produksjonsskjema og read-only kontroll ga `PASS`. Filbasert Bonus Weeks-regresjon kjører i CI før build, og siste Vercel-deploy er grønn.
- MP-07.7 ⬜ **Rundehistorikk / historisk lagvisning:** brukeren skal kunne åpne tidligere fantasy-runder og se nøyaktig hvilket lag som var låst/snapshotet i den aktuelle runden, inkludert spillere, rekker/oppstilling, kaptein, visekaptein, eventuelle boostere, benyttede bytter og rundepoeng. Historikken skal bygge på autoritative snapshots og aldri rekonstrueres fra dagens lag dersom historiske data finnes.
- MP-07.8 ⬜ **Personlig statistikkdashboard:** bygg grafer og tabeller for brukerens fantasyhistorikk. Minimum: poeng per runde, kumulative poeng, totalrank/rankutvikling, runderank, endring i rank, lagverdi over tid, poeng fordelt på posisjon, kaptein/visekaptein-bidrag, benyttede bytter og poenggevinst/-tap fra transfers der dette kan beregnes sikkert.
- MP-07.9 ⬜ **Utvidede fantasy-stats og sesonginnsikt:** vurder og prioriter flere forklarbare nøkkeltall, blant annet beste/verste runde, gjennomsnittspoeng per runde, median, antall topp-X-runder, beste kapteinsvalg, kapteinspoeng som andel av totalen, mest brukte spillere, lengst beholdte spiller, beste/verste transfer, transfer-hit/kostnad mot gevinst, lagfordeling per klubb, pris-/lagverdiutvikling, total xFP mot faktiske poeng, over-/underprestasjon mot xFP, availability-tapte poeng, fixture-utnyttelse, Bonus Week-resultater og sammenligning mot overall-snitt, topp 10 % og topp 1 % når datagrunnlaget tillater det. Stats skal være forklarbare og skal ikke presenteres som sikre dersom datagrunnlaget er ufullstendig.

# MP-08 – Analyse, xFP og anbefalinger

**Status: ✅ – analyseinput og fixture-rating er produksjonsverifisert og stabilt for videre Fantasy-analyse**

- MP-08.1 ✅ Samlet admin-kommandosenter for analyse er implementert og produksjonsbrukt.
- MP-08.2 ✅ **Preseason-FP er avviklet.** Treningskampstatistikk skal ikke brukes til å beregne xFP, spillerform, anbefalinger eller annen Fantasy-beslutningsstøtte. Datagrunnlaget fra treningskamper er for ufullstendig og inkonsistent til å gi et pålitelig signal. Aktiv preseason-FP-kode/adminflate er fjernet fra `main`; historiske migrasjoner/data kan beholdes inert for sporbarhet.
- MP-08.3 ✅ **Preseason-statistikkpipeline er avviklet.** Manuell registrering, ekstern kildeimport, parser-preview og debug/diagnostikk som kun eksisterte for treningskamp-FP skal ikke videreutvikles eller inngå i ordinær arbeidsflyt. Dette påvirker ikke vanlig roster-, terminliste- eller prisarbeid før sesongstart.
- MP-08.4 ✅ Kanonisk analyse-featurelag `get_fantasy_analysis_features_admin_v1` samler sesong-FP/kamp, form 3/5/10, hjemme/borte, sample counts, pris og observert FP/kamp per million før modellberegning. Den raske `get_fantasy_xfp_round_horizons_admin_v2` bruker featurelaget direkte, og anbefalingene arver samme grunnlag via horisont-RPC-en. Form 5 beholdes som modellens form-input; scoringregler og xFP-vekter er uendret. Produksjonsverifisert 2026-08-21 med 234 feature-rader, 234 xFP-horisont-rader og 234 anbefalingsrader samt grønn Vercel-build.
- MP-08.5 ✅ Dynamisk fixture-/motstanderrating er produksjonskalibrert uten treningskampdata. Autoritativ startbaseline kommer fra ordinær EHL 2025/26: F/D vurderes mot motstanders GA relativt til ligasnitt, G mot motstanders GF relativt til ligasnitt. Live-kurven bruker eksponent 0,80 med sikkerhetsgrenser 0,70–1,35. 2026/27-data fases lineært inn over lagets første 12 ferdigspilte seriekamper: kamp 0 = 100 % historisk baseline, kamp 6 = 50/50 og kamp 12+ = 100 % live. Ringerike bruker nøytral 1,000-baseline fordi ordinært 2025/26-EHL-grunnlag mangler. Produksjonskontroll bekrefter 0 ferdigspilte 2026/27-kamper ved kalibrering, korrekt historisk baseline og ingen avhengighet til preseason-/treningskampstatistikk. Adminflaten eksponerer historisk baseline, live, blended factor, datagrunnlag og 1–5-rating. Vercel-build er grønn.
- MP-08.6 ✅ Kjøp / hold / selg-score med forklarbare komponenter er implementert og produksjonsbrukt.
- MP-08.7 ✅ Kapteinscore/anbefaling er implementert og produksjonsbrukt.
- MP-08.8 ✅ Forventede poeng for neste kamp, neste fantasy-runde og tre fantasy-runder er implementert på den raske horisontmotoren, med tydelig skille mellom base-xFP, availability-justert xFP og lineup-kontekst.

# MP-09 – Skader, fravær og tilgjengelighet

**Status: ✅ kjerne produksjonsverifisert / 🔵 reelle funn overvåkes gjennom sesongen**

- MP-09.1 ✅ Datamodell for spiller-tilgjengelighet etablert.
- MP-09.2 ✅ Admin-API og admin-side for tilgjengelighet etablert.
- MP-09.3 ✅ Status for «ikke i kamptropp» støttes.
- MP-09.4 ✅ Dokumentert kildeinnhenting etablert: allowlistede EHL-klubbsider og nitten.no med freshness-gate/deduplisering, samt HockeyLive MatchTeamMembers-kontroll for preseason og ordinære 2026/27-kamper. Eksterne funn legges kun i review-kø og publiseres aldri automatisk. nitten.no-parseren er historisk backtestet mot to golden-artikler med 45/45 korrekte klassifiseringer og 0 writes.
- MP-09.5 ✅ Sikker roster-matching og adminverifisering etablert og produksjonsverifisert. Usikre/tvetydige funn krever manuell kontroll; godkjenning verifiserer aktiv roster-spiller og oppdaterer availability + historikk + funnstatus atomisk.
- MP-09.6 ✅ Kun admin-godkjent availability påvirker xFP, anbefalinger og optimalisator. Produksjonsverifisert policy: `available` 100 %, `returning` 85 %, `questionable` 60 %, `out`/`long_term`/`not_in_lineup` 0 %. Blokkerte spillere kan ikke foreslås av optimizeren. Availability-effekt-siden bruker en lett, sikker server-side datavei uten full-xFP-timeout.
- MP-09.7 ✅ Varslingskjeden er implementert og teknisk produksjonsverifisert: preview av berørte fantasy-eiere, RLS-beskyttet delivery-ledger, unik deduplisering/idempotens, atomisk delivery-RPC og faktisk produksjonsvarsel til korrekt fantasy-eier er testet. Testdata/varsel ble ryddet etter verifisering. Godkjenning av nye reelle review-funn er nå koblet til varslingssenteret; første naturlige E2E via et reelt nytt funn verifiseres når et slikt funn oppstår, uten å opprette falske skadefunn.

# MP-10 – Lagoptimalisator

**Status: ✅ – komplett adminverktøy implementert og produksjonsverifisert 2026-08-23**

- MP-10.1 ✅ Komplett input er koblet til adminens faktiske lag, gjeldende budsjett og autoritative transferstatus. Admin kan låse spillere som ikke skal foreslås UT; låsene valideres mot nåværende lag og låste spillere ekskluderes fra outgoing-poolen.
- MP-10.2 ✅ Output i `Admin → Analyse → Optimalisator` viser tydelige `UT → INN`-forslag, ny lagverdi, forventet xFP-gevinst, risiko, availability, datatillit og forklarbar base-/availability-/effektiv Fantasy-xFP. Optimalisatoren er ikke tilgjengelig i ordinær Fantasy-navigasjon og har ingen offentlig `/fantasy/optimizer`-flate eller offentlig optimizer-API.
- MP-10.3 ✅ Forventet poenggevinst, risikoscore, risiko per foreslått INN-spiller, datatillit, availability-justert xFP og effektiv Fantasy-xFP etter rekke/C/VC er implementert og produksjonsverifisert.
- MP-10.4 ✅ Balansert, konservativ og offensiv strategi er modellberegnet med ulike risiko-/oppsideobjektiver. Forventet gevinst, risiko, modellert oppside og avvikende UT → INN-bytter vises. Produksjonsverifisert 2026-08-21 og beholdt gjennom sluttføringen.
- MP-10.5 ✅ Optimizeren bruker autoritativ `get_fantasy_transfer_status_v1` og de endelige MP-04-reglene: maks 2 permanente bytter per ordinær runde, ingen byttebank, ingen poengtrekk, opptil 4 med Bytteboost og 0 permanente transfers i Rik/Fattig Onkel. Bytteboost-søket bruker en begrenset flerfaktor-kandidatpool for å holde 4-byttesøk produksjonsforsvarlig, mens endelig budsjett-, posisjons-, klubb-, lineup- og availability-validering fortsatt skjer på hvert forslag. Compatibility-RPC-ene som ble introdusert under sluttbrukerforsøket er nå eksplisitt admin-only og `anon` har ikke EXECUTE. Availability-gaten er uendret og blokkerte spillere kan ikke foreslås.

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
- MP-12.3 🟡 Utvid regresjonsdekning for scoring, transfers, deadlines, RLS og admin. Bonus Weeks-, MP-04 transfer- og MP-10 optimizerkontrakter kjøres automatisk i CI uten produksjonswrites.
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

1. **Chat 07 – MP-07.7 + MP-07.8 + MP-07.9: rundehistorikk og personlig fantasy-statistikk.** Bygg historisk lagvisning fra autoritative snapshots, grafer/tabeller og prioriter de mest nyttige sesongstatsene. Transferhistorikk, Bonus Week-metadata og ferdig admin-optimizer-/analysegrunnlag kan nå brukes som sikre støttedatasett uten å rekonstruere historiske lag fra dagens lag.
2. **Chat 07 + Chat 11 – MP-07.4/07.5 og MP-11.3–11.5: konkurransepresentasjon og samlet UX-pass.** Rundevisning, regler, mobil/desktop, readability og states.
3. **Chat 12 – MP-12.3 + MP-12.7: bred regresjon og pre-launch kvalitet.** Scoring, transfers, deadlines, RLS, admin og sentrale brukerflyter.
4. **Chat 01 + Chat 14 – MP-01.6 og MP-14.1–14.7: produksjons- og launch-gate.** Regelverk, 45 runder/deadlines, produksjon, cron/secrets, smoke tests, backup og rollback.
5. **Chat 14 – MP-14.8: GO LIVE** når alle kritiske launch-gates er PASS.

**Sesongavhengig:** MP-06.6 full produksjonsvalidering mot faktiske 2026/27-kamper gjennomføres i **Chat 06** så snart representative seriekamper finnes. MP-02.6 og øvrig synk/datadrift fortsetter løpende. MP-09 følger nye reelle availability-funn gjennom sesongen og første naturlige E2E via review-køen verifiseres ved første faktiske funn. **Chat 13 / MP-13** er et separat tipping-spor som kan utvikles parallelt så lenge det ikke blokkerer Fantasy XI-kritisk arbeid.

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