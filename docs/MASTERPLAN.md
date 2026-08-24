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

- MP-07.1 ✅ Sesong-leaderboard implementert.
- MP-07.2 ✅ Isolert leaderboard E2E-test og testkontroller implementert.
- MP-07.3 ✅ Rundering/rank, bevegelse og egen-lag-markering implementert.
- MP-07.4 ✅ **Rundevisning og konkurransepresentasjon:** `/fantasy/rounds` er produksjonspolert med neste runde automatisk åpnet, kampvindu/deadline, kampoversikt og eksplisitt visning av lag med 0 eller flere kamper i runden. Mobilvisningen er tilpasset uten å endre autoritativ runde-/deadline-logikk. Vercel-verifisert grønn 2026-08-23.
- MP-07.5 ✅ **Konkurranse-/tie-break-regelverk:** endelig sammenlagtrangering er 1) totalpoeng, 2) flest rundeseire, 3) høyeste enkelt-rundescore. Dersom alt fortsatt er likt deles plasseringen. Teamnavn brukes kun til stabil visningsrekkefølge og er ikke sportslig tie-break. Samme kriterier brukes ved previous-rank/movement, og reglene er publisert på Regler-siden. Premieoppsett kan fastsettes separat uten å endre rankingmotoren.
- MP-07.6 ✅ **Bonus Weeks / fantasy-boostere:** komplett regel-, data-, scoring-, transfer-, snapshot-, UI- og historikksystem er implementert. Hvert lag har én Kapteinsboost (C ×2,5), én Rekkeboost (rekke 2 = 100 %) og én Bytteboost (opptil 4 bytter) per sesong, maks ett personlig kort per runde og eksisterende deadline som aktiverings-/låsegrense. Felles Event Weeks er **Rik Onkel** med separat 200m-lag og **Fattig Onkel** med separat 70m-lag; eventlag påvirker aldri permanent 100m-lag eller ordinær transferhistorikk. Personlige kort er sperret i Event Weeks. Booster/eventmetadata fryses i snapshot og brukes av autoritativ scoring/historikk. Double gameweeks støttes ved at alle kamp-poeng i runden summeres før multiplikatorer. MP-12 behavioral E2E 2026-08-24 verifiserte Kapteinsboost ×2,5, Rekkeboost ×1,0 på rekke 2, én booster per runde, kansellering før commit, Event Week-kollisjon og cleanup 6/6. En reell tvetydig `ON CONFLICT`-feil i Event Week-konfigurasjon ble funnet av testen, reparert med eksplisitt unique-constraint-target og verifisert på nytt.
- MP-07.7 ✅ **Rundehistorikk / historisk lagvisning:** komplett snapshot-first historikk er implementert og produksjonsverifisert 2026-08-23. `/fantasy/my-rounds` starter fra autoritative `fantasy_team_round_snapshots` + snapshotspillere, aldri fra dagens lag eller transferrekonstruksjon. Spillernavn, klubb, posisjon, pris, rekke, kaptein og visekaptein fryses i snapshotet; score og spillermultiplikatorer kobles kun på via `LEFT JOIN`, slik at et låst lag kan vises før runden er ferdigscoret. Rekke 1/2, C/VC, lagverdi, Bonus/Event Week-metadata, rundepoeng og relevante permanente transfers vises i historikken; Event Weeks skjuler ordinær transferkontekst. Personlig RPC er authenticated-only (`anon` uten EXECUTE), filbasert regresjon er koblet til CI, og Vercel-deploy er grønn. Produksjonen hadde 0 ekte 2026/27-snapshots ved verifikasjon, så ingen falske eller eksisterende historiske lagdata ble skrevet eller endret.
- MP-07.8 ✅ **Personlig statistikkdashboard:** `/fantasy/stats` er implementert som del av Poeng-seksjonen med poeng per runde, kumulative poeng, sammenlagtrank/rankutvikling, runderank, rankendring, lagverdi over tid, poeng per posisjon, C/VC-bidrag og benyttede transfers. Statistikken bygger på autoritative snapshots/scoring og rekonstruerer aldri historikk fra dagens lag. Usikre kontrafaktiske tall som transfergevinst/-tap vises ikke uten sikkert historisk grunnlag.
- MP-07.9 ✅ **Utvidede fantasy-stats og sesonginnsikt:** sikre, forklarbare sesongmål er implementert: beste/verste runde, snitt, median, rundeseire, topp-10 %- og topp-1 %-runder, kapteinsandel, beste Bonus/Event Week, mest brukte spiller, lengst beholdte spiller, beste C/VC-valg, klubbfordeling og sammenligning mot feltets faktiske snitt. Personlige stats-RPC-er er authenticated-only og `anon` har ikke EXECUTE. Beste/verste transfer, historisk xFP-over/underprestasjon, availability-tapte poeng og lignende holdes bevisst ute inntil sikkert historisk/kontrafaktisk datagrunnlag finnes; de skal ikke gjettes fra dagens data.

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

**Status: ✅ samlet Fantasy UX-/mobilpass ferdigstilt 2026-08-23**

- MP-11.1 ✅ **Navigasjon og felles Fantasy-layout:** Fantasy-hovedmenyen samler Mitt lag/Eventlag/Bytter og Poeng/Rundehistorikk/Min statistikk i interne seksjoner; Achievements er integrert i Leaderboard. Mobilfeilen der Fantasy ble markert som «Profil» i globalmenyen er fjernet, 8/7-gridavviket er rettet, og Fantasy-menyen bruker en eksplisitt mobilgrid uten nødvendig horisontal scrolling.
- MP-11.2 ✅ **Leaderboard og konkurransepresentasjon:** desktop-/mobilpresentasjon, egen-lag-markering, achievements, historikk og redusert kolonnevisning på små skjermer er kontrollert. Eksisterende løsning ble beholdt der den allerede var god.
- MP-11.3 ✅ **Lagbygger, spillerflater, runder og statistikk:** Mitt lag, Eventlag og Bytter er harmonisert med større touch targets og konsistent panel-/kontrollspråk. `/fantasy/players` er bygget om til en beslutningstabell med faktiske FP, FP/kamp, Form 5, eierandel, pris og neste gameweek/motstander(e), med sortering og mobilkort uten horisontal scrolling. FP-tallene kommer fra authenticated-only read-RPC `get_fantasy_player_market_summary_v1`, som bruker samme siste-beregning-per-kamp-semantikk som spillerprofilen; `anon` har ikke EXECUTE. Spillerprofil, runder, DGW/BGW-visning, Stats og Regler er mobilpolert; Stats' 820px runde-tabell og Regler-tabellene blir kortvisning på telefon.
- MP-11.4 ✅ **Samlet UX-pass:** Fantasy-forsiden er justert til den forenklede informasjonsarkitekturen, Eventlag/Bytter er visuelt samlet med resten av Fantasy, sidebredder/spacings/touchflater er harmonisert og eksisterende fungerende forretningslogikk er beholdt uendret.
- MP-11.5 ✅ **Readability/loading/error/empty states:** tydeligere states er lagt inn på sentrale flater, blant annet Spillere, spillerprofil, Bonus Weeks og Rundehistorikk. Bonus Weeks har eksplisitt loading/error/retry, og Rundehistorikk forklarer at historikken blir tilgjengelig når laget først låses ved deadline. Ingen scoring-, snapshot-, deadline-, transfer-, Event Week-, Booster-, budsjett-, C/VC- eller leaderboardregel ble endret i UX-passet.

# MP-12 – Testing, sikkerhet og datakvalitet

**Status: ✅ pre-launch regresjon ferdigstilt 2026-08-24 / 🔵 kontinuerlig kvalitetsgate**

- MP-12.1 ✅ Build-CI på push/PR til `main`. CI kjører MP-12 scoring-, security- og test-isolation-gater, MP-13 scoring/readiness, MP-04 transfers, Bonus Weeks, MP-07 rundehistorikk/stats, MP-10 optimizer og full Next/TypeScript-build.
- MP-12.2 ✅ Isolerte service-only E2E-verktøy dekker sentrale produksjonsflyter med syntetiske `__e2e_*`-sesonger: scoring/C/VC, snapshots/freeze, DGW/BGW, round automation, Bonus/Event Weeks og transfers. I tillegg er rundedetaljer, leaderboard/tie-break/rundehistorikk og achievements kjørt på egne isolerte test-sesonger.
- MP-12.3 ✅ Bred regresjonsdekning er etablert og produksjonsverifisert for scoring, transfers, deadlines/snapshots, round automation, RLS/sikkerhet, Bonus/Event Weeks, leaderboard/rundehistorikk og sentrale brukerdataflyter. Behavioral kontrollresultater ved sluttføring: lagscoring 5/5, snapshot/freeze 4/4, DGW/BGW 4/4, round automation 5/5, rundedetaljer 5/5, leaderboard 5/5, achievements 5/5, Bonus/Event 6/6 og transfers 6/6.
- MP-12.4 🔵 Ingen test skal endre ekte 2026/27-data. Legacy-testhelperne som kunne skrive i ekte sesongnamespace er fjernet; syntetisk transfersti krever eksplisitt `service_role` + `__e2e_*`, mens ordinære authenticated-brukere fortsatt er hardlåst til `2026/27`.
- MP-12.5 🔵 Nye tester skal rydde opp egne data. Sluttkontrollen 2026-08-24 viste 0 rester i kontrollerte `__e2e_*` lag, runder, kamper, transferbatcher, boostere, sesongpriser og sesongregler.
- MP-12.6 🔵 Ikke svekk auth/RLS/sikkerhet for testbarhet. Sluttauditen viste 0 anon-kjørbare Fantasy `SECURITY DEFINER`-funksjoner; `audit_fantasy_price_publication` ble endret til `SECURITY INVOKER` slik at eksisterende admin-RLS gjelder. Nye behavioral E2E-RPC-er er service-only.
- MP-12.7 ✅ Full pre-launch regresjonstest er gjennomført mot faktisk `main` og produksjonsskjema. Produksjon sto etter testene fortsatt på 45 autoritative fantasy-runder, 225 kamper, 239/239 current-roster/kjøpbare spillere med 2026/27-pris og 0 testrester. Testarbeidet oppdaget og reparerte to reelle pre-launch-feil: manglende schema-kontrakt for lagscoring (`fantasy_round_games`/`fantasy_game_player_points`) og tvetydig Event Week-upsert. Begge er regresjonsbeskyttet og produksjonsverifisert.

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

1. **Chat 01 + Chat 14 – MP-01.6 og MP-14.1–14.7: produksjons- og launch-gate.** MP-12.3 + MP-12.7 er ferdig; neste effektive steg er å verifisere endelig regelverk, 45 runder/deadlines, produksjonsmiljø, cron/synk/secrets, mobil/desktop smoke tests samt backup/rollback før GO LIVE.
2. **Chat 14 – MP-14.8: GO LIVE** når alle kritiske launch-gates er PASS.

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