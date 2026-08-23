# Stang Inn – PROJECT STATUS

Sist kontrollert mot GitHub `main`: 2026-08-23

## Source of truth

- Teknisk sannhet: GitHub `main`.
- Prosjektplan/prioritering: `docs/MASTERPLAN.md`.
- Denne filen: kort teknisk kontrollpunkt for nye arbeidsøkter/chatter.
- Eldre roadmap-filer er historisk/tematisk dokumentasjon og skal ikke overstyre `MASTERPLAN.md` eller faktisk kode på `main`.

## Stack

- Next.js 16.2.11
- React 19.2.0
- TypeScript 5.9.x
- Supabase
- Vercel
- GitHub Actions build-CI + Bonus Weeks-kontrakt/regresjon

## EHL 2026/27

- Tournament ID: `448981`.
- Preseason-spillerpoolen er verifisert mot EliteProspects som autoritativ preseason-fasit.
- Produksjon har 239 aktive/current-roster-spillere fordelt på 10 kanoniske EHL-lag: Frisk Asker 23, Lillehammer 22, Narvik 24, Nidaros 23, Ringerike 24, Sparta 25, Stavanger 25, Stjernen 25, Storhamar 25 og Vålerenga 23.
- Full EliteProspects-audit: 239/239 matchet, 0 mangler, 0 tvetydige, 0 lagavvik, 0 ekstra og 0 posisjonsavvik.
- Klubbverdier er normalisert; 0 ikke-kanoniske current-roster-lagverdier og 0 duplikate external IDs.
- Matteo Mitrovic, Johan Tørres Selnes og Mathias Dehli er verifisert aktive/current på Narvik.
- Fire EP-bekreftede spillere uten tilgjengelig NIF-ID bruker eksplisitt provisorisk `ep:`-identitet: Filip Bratt, Matteo Mitrovic, Alexander Bjurström og Ludwig Blomstrand. NIF-ID skal aldri oppdiktes; senere overgang til NIF-identitet skal skje eksplisitt og sikkert.
- HockeyLive tournamentId `448981` beholdes for kamp-/ID-data. `TournamentPlayers` var tom preseason, og `TournamentTeams -> TeamMembers` skal ikke behandles som autoritativ sesongroster.
- Kalenderbasert fantasy-rundestruktur og deadline/snapshot-system er implementert.

## Fantasy – implementert kjerne

- Spillerpool og pris-publisering.
- Prismodellfamilie gjennom v4.3, inkludert v4.1 markedskalibrering og import-/talentlogikk.
- MP-03.6 sluttkalibrering er publisert som V4.6.2. Produksjon er kontrollert med 239/239 current-roster-spillere priset, 239/239 låste sesongpriser, 239/239 kjøpbare, nøyaktig 14 godkjente prisendringer, 0 avvik mellom spillerpris og sesongpris, 0 stale lagrede `purchase_price` og 0 eksisterende lag over 100m. Ingen fantasy-scoringregler ble endret.
- Persistente brukerlag.
- Kaptein og visekaptein.
- Klubb-/lagvalideringer.
- MP-04.7 gameweek-fixtures i «Mitt lag»: hver valgt spiller viser motstander(e) for den fantasy-runden laget bygges/redigeres for, med H/B-markering og eksplisitt «Ingen kamp». Visningen bruker den autoritative `get_fantasy_round_schedule_v1`-rundelogikken og felles `canonicalFantasyTeam()` for å koble HockeyLive-klubbnavn til kanoniske Fantasy-lag. Ingen ny database-/terminlistelogikk ble innført.
- Kalenderbaserte runder.
- Deadline-sikre snapshots og freeze/readiness-kontroller.
- Fantasy-poengmotor med special-teams-relatert scoring.
- Kaptein ×2 og visekaptein ×1,5.
- Sesong-leaderboard, rundering/rank og movement UI.
- **MP-07.6 Bonus Weeks er implementert og produksjonsverifisert.** Hvert lag har én Kapteinsboost (C ×2,5), én Rekkeboost (rekke 2 = 100 %) og én Bytteboost (opptil 4 bytter) per sesong. Maks ett personlig kort kan brukes i samme fantasy-runde, og kortene følger eksisterende deadline/snapshot-gate.
- **Rik Onkel og Fattig Onkel er implementert som felles Event Weeks.** Rik Onkel bruker separat midlertidig 200m-eventlag, Fattig Onkel separat 70m-eventlag. Eventlagene ligger fysisk separat fra permanentlaget, lager ingen permanente transfers og ordinært 100m-lag kommer tilbake uendret etter eventrunden.
- Personlige boosterkort er sperret i Rik/Fattig Onkel. Eventlag bruker vanlige posisjons-, klubb-, rekke- og C/VC-regler og samme autoritative rundedeadline.
- Bonus-/eventmetadata fryses i autoritative snapshots (`booster_type`, `event_type`, `event_budget` og relevante multiplikator-overstyringer), slik at historisk re-scoring er deterministisk.
- Autoritativ scoring støtter Kapteinsboost og Rekkeboost samt 0/1/flere kamper i samme fantasy-runde; alle kamp-poeng summeres før rekke-/rolle-multiplikatorer.
- Bytteboost øker server-side transfergrensen 2 → 4 og blir irreversibel når bytte nummer 3 gjennomføres. Permanente transfers er sperret i Event Weeks.
- «Mitt lag» har boosterkort-UI med tilgjengelig/valgt/låst/brukt-status og tydelig regeltekst. Eventlag har egen side med 200m/70m-budsjett, deadline og tydelig informasjon om at permanentlaget ikke påvirkes.
- Leaderboardets utfoldbare rundehistorikk viser boost/event-markører fra snapshotet uten å fylle hovedtabellen med ekstra kolonner.
- Spillernavn i lagbygger/spillermarked og Eventlag åpner spillerens profil, mens lagvalg håndteres separat.
- Admin/analysegrunnlag med avviklet preseason-FP/treningskampstatistikk som Fantasy-signal.
- MP-08.4 kanonisk analyse-featurelag `get_fantasy_analysis_features_admin_v1`: sesong-FP/kamp, form 3/5/10, hjemme/borte, sample counts, pris og observert FP/kamp per million samles før modellberegning. Den raske xFP-horisonten bruker featurelaget direkte; anbefalingene arver samme datagrunnlag. Form 5 er fortsatt modellens form-input, og verken scoringregler eller xFP-vekter ble endret.
- MP-08.5 dynamisk fixture-/motstanderrating er produksjonskalibrert uten treningskampdata. Historisk baseline bruker ordinær EHL 2025/26, posisjonsbevisst GF/GA-logikk, live-kurve med eksponent 0,80 og clamp 0,70–1,35. 2026/27-data fases lineært inn over de første 12 ferdigspilte seriekampene; Ringerike bruker nøytral 1,000-baseline på grunn av manglende ordinært EHL-grunnlag fra 2025/26. Produksjonskontroll bekrefter at den autoritative motstanderfaktoren ikke leser preseason-/treningskampstatistikk.
- Availability-datamodell, admin-API og admin-UI, inkludert «ikke i kamptropp».
- Ikke-autoritativ availability-funnkø med kilde, matchforslag, confidence, reviewstatus og audit.
- Konservativ roster-matching: usikre/tvetydige funn krever manuell admin-kontroll.
- Atomisk admin-godkjenning: gjeldende availability, historikk og funnstatus oppdateres i én PostgreSQL-transaksjon.
- Deterministisk kildeinnhenting fra allowlistede EHL-klubbsider og nitten.no med 45-dagers freshness-gate og deduplisering.
- HockeyLive MatchTeamMembers-kontroll for preseason og ordinære `fantasy_games`; ufullstendige kamptropper hoppes over, og fravær kan kun foreslå `not_in_lineup`.
- Lagoptimalisator med «beste komplette oppstilling» og «optimaliser med ledige bytter» på den raske `get_fantasy_xfp_round_horizons_admin_v2`-dataveien.
- Availability-policy i optimizer: `available` 100 %, `returning` 85 %, `questionable` 60 %, og `out`/`long_term`/`not_in_lineup` ekskluderes.
- MP-10.3 produksjonsverifisert: forventet poenggevinst, risikoscore, spiller-risiko, datatillit, availability-justert xFP og effektiv Fantasy-xFP med rekke/C/VC.
- MP-10.4 produksjonsverifisert 2026-08-21: Balansert, Konservativ og Offensiv bruker separate modellobjektiver og viser forventet gevinst, risiko, modellert oppside og UT → INN-forskjeller.

## Aktivt område / neste kobling

MP-02 preseason-rosterkontroll er produksjonsverifisert mot EliteProspects: 239/239 spillere, 0 mangler, 0 tvetydige, 0 lagavvik, 0 ekstra og 0 posisjonsavvik. Robust identitetsgate og løpende MP-02.6-drift beholdes.

MP-08.4 og MP-08.5 er produksjonsverifisert. Det kanoniske featurelaget og den raske xFP-/anbefalingskjeden er stabilt for videre fantasyarbeid. Fixture-/motstanderratingen bruker ordinær 2025/26-baseline og kontrollert overgang til live 2026/27-data uten treningskampstatistikk.

MP-03.6 er ferdig og produksjonsverifisert som V4.6.2. Prisuniverset er nå komplett 239/239 og konsistent mellom spillerpool, låste sesongpriser og lagrede preseason-lag.

MP-04.7 er ferdig på `main`. «Mitt lag» gjenbruker `fantasy_rounds` + `get_fantasy_round_schedule_v1`, velger effektiv transfer-runde når den finnes og ellers neste deadline, normaliserer kampklubber med felles `canonicalFantasyTeam()`, og viser 0/1/flere kamper med H/B direkte under spillerens klubb/posisjon. Produksjonsdata bekrefter både runder med lag uten kamp og runder med dobbeltkamper.

**MP-07.6 er ferdig og produksjonsverifisert 2026-08-23.** Regelspesifikasjon, datamodell, sikre booster-/event-RPC-er, eventlag, snapshots, scoring, Bytteboost, UI, leaderboard-historikk og filbasert regresjonsdekning er på `main`. Under implementeringen ble en faktisk produksjonsskjema-mismatch i spiller-rundepoeng oppdaget og reparert; aktiv scoringfunksjon er verifisert schema-aligned (`PASS`).

**Neste operative hovedpunkt er Chat 04 – MP-04.5 + MP-04.6:** full transfersyklus og endelige låseregler. Bonus Weeks-reglene er nå låst, slik at transferbank/frie bytter/historikk og endelig regelverk kan ferdigstilles uten uavklarte boosteravhengigheter.

MP-09-kjernen er produksjonsverifisert. Kun admin-godkjent availability påvirker analyse/optimizer, og blokkerte statuser kan ikke foreslås. Varslingskjeden er teknisk produksjonsverifisert og første naturlige E2E via et reelt nytt review-funn tas når et slikt funn oppstår.

MP-10.3 og MP-10.4 er ferdige og produksjonsverifiserte på `main`. Fixture/xFP- og prisinput er stabile; resterende MP-10.1/10.2/10.5 tas etter MP-04.5/04.6 i henhold til `docs/MASTERPLAN.md`.

## Testing

- GitHub Actions kjører `npm run test:bonus-weeks` før `npm run build` på push/PR mot `main`.
- Bonus Weeks-regresjonen er deterministisk og filbasert og skriver aldri til Supabase. Den beskytter kritiske kontrakter for eventlag-isolasjon, 200m/70m, booster inventory/stacking/deadline, snapshotmetadata, Kapteins-/Rekkeboost, double-GW-summering, Bytteboost, Event Week-transfer-sperre og historikkmarkører.
- Siste MP-07.6L-commit `fb9ee0a` er Vercel-verifisert `SUCCESS` 2026-08-23.
- Schema-reparasjonen for Bonus Weeks-scoring ble manuelt kjørt i Supabase og read-only verifisert med `scoring_schema_alignment = PASS`.
- Isolerte E2E-/testkontroller er implementert for sentrale fantasyflyter, blant annet snapshots og leaderboard.
- MP-04.7 er build-/Vercel-verifisert på `main`. Produksjonsdata viser 45 autoritative fantasy-runder; runde 7/9/20/24 har bare 8 deltakende lag (0 kamper for to lag), mens runde 11/13/14/39 har lag med 2 kamper. Linus Pettersson er `Stavanger · W`, og runde 1 har Stavanger borte mot Vålerenga. Responsive CSS lar fixturelinjen brytes på mobil uten å endre eksisterende lagbygger-grid.
- MP-08.4-produksjonssmoke: featurelag 234 rader, xFP-horisont 234 rader og anbefalingsdatasett 234 rader ved opprinnelig kontroll; API-endringen er Vercel-build/deploy-verifisert.
- MP-08.5-produksjonskontroll: 225 ordinære 2025/26-kamper brukt til historisk baseline, 0 ferdigspilte 2026/27-kamper ved kontrolltidspunktet, posisjonslogikk verifisert og autoritativ faktor kontrollert uten preseason-/treningskampavhengighet. Vercel-build er grønn.
- MP-03.6-produksjonskontroll: V4.6.2 har 239 publikasjonrader/current-roster-spillere, 14 faktiske prisendringer, 0 prislag-avvik, 239 kjøpbare spillere, 0 stale `purchase_price` og 0 eksisterende lag over 100m. Merge-/produksjonsdeploy er grønn.
- Availability-endringene og optimizerstrategiene er build-/deploy-verifisert; produksjonsbruk følger fortsatt admin-review-gaten for availability.
- Produksjonsregelen står fast: isolerte tester skal ikke endre ekte 2026/27-data og skal rydde opp egne testdata.

## Kjente dokumentasjonsforhold

`README.md` beskriver fortsatt eldre prosjektstatus (bl.a. v0.3/v0.4-fase) og er ikke oppdatert til dagens fantasyimplementasjon. Bruk `MASTERPLAN.md` og denne filen som operativ oversikt inntil README er modernisert.

`docs/fantasy-roadmap.md` inneholder den opprinnelige fantasyretningen og er fortsatt nyttig for mål/prinsipper, men flere punkter er allerede implementert utover statusen som fremgår der.

## Arbeidsstart i ny ChatGPT-chat

Ved ny arbeidschat:

1. Les `docs/MASTERPLAN.md`.
2. Les `docs/PROJECT_STATUS.md`.
3. Kontroller siste commits og relevante filer på `main` for MP-punktet som skal arbeides med.
4. Ikke anta at chat-historikk er nyere enn GitHub.
5. Implementer/test/verifiser ett avgrenset steg om gangen.
6. Oppdater masterplan/status når et hovedsteg faktisk er ferdig.