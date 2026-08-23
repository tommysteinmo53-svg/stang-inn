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
- GitHub Actions build-CI + Bonus Weeks-, MP-04 transfer-, MP-07.7 rundehistorikk- og MP-10 optimizerkontrakt/regresjon

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
- **MP-04.5/MP-04.6 transfer-/regelkjernen er ferdigstilt.** Fast modell: maks 2 permanente spillerbytter per ordinær fantasy-runde, ingen byttebank og ingen poengtrekk. Bytteboost øker grensen til 4 og låses når lagret transferbruk passerer 2. Endringer teller først når de lagres server-side; lagrede bytter refunderes ikke. Rekke, kaptein, visekaptein og lagnavn er gratis endringer. Event Weeks sperrer permanente transfers.
- Transferledger bruker `fantasy_transfer_batches` + `fantasy_transfer_items` med runde, tidspunkt, antall, lagverdi før/etter og alle INN/UT-spillere med pris. Autentisert read-only RPC `get_my_fantasy_transfer_history_v1` er migrert til produksjon, og `/fantasy/transfers` viser regler og historikk responsivt. Eventlag er fysisk separate og inngår aldri i permanent transferhistorikk.
- Endelig transfer-/låseregelverk er dokumentert i `docs/FANTASY_TRANSFER_RULES.md`. Snapshot ved deadline er historisk fasit, og senere transfers skal aldri rekonstruere eller endre tidligere runder.
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
- **MP-07.7 rundehistorikk er ferdigstilt som snapshot-first brukerhistorikk.** `get_my_fantasy_round_history_v1` starter fra `fantasy_team_round_snapshots` og `fantasy_team_round_snapshot_players`; dagens `fantasy_user_team_players` brukes aldri til historisk rekonstruksjon. Snapshotspillere fryser nå også `player_name` i tillegg til klubb, posisjon, pris, rekke, C/VC. Score, kampantall og multiplikatorer er nullable `LEFT JOIN`-kontekst, slik at et snapshot kan vises umiddelbart etter deadline før runden er scoret. `/fantasy/my-rounds` viser rekke 1 og rekke 2, lagverdi ved snapshot, C/VC, Bonus/Event Week, rundepoeng når de finnes og ordinære transfers knyttet til runden. Event Weeks viser ikke permanent transferledger. RPC-en er authenticated-only og `anon` har ikke EXECUTE.
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
- **MP-10 lagoptimalisator er ferdigstilt og produksjonsverifisert 2026-08-23 som adminverktøy.** Den ligger kun under `Admin → Analyse → Optimalisator`; den ordinære Fantasy-navigasjonen inneholder ikke optimizer, og `/fantasy/optimizer` samt offentlig `/api/fantasy/transfer-optimizer` er fjernet.
- Admin kan låse spillere som ikke skal foreslås UT. Låse-ID-er valideres mot adminens faktiske lag og låste spillere ekskluderes fra outgoing-poolen.
- Optimizeren bruker autoritativ `get_fantasy_transfer_status_v1`: 2 permanente bytter ordinært, ingen bank/hits, opptil 4 med Bytteboost og 0 permanente transfers under Rik/Fattig Onkel. Den gamle optimizer-hardgrensen på 2 er fjernet.
- Bytteboost-søk med opptil 4 bytter er produksjonssikret med en begrenset flerfaktor-kandidatpool basert på xFP, verdi, pris, risiko og oppside før full budsjett-/posisjons-/klubb-/lineup-validering.
- Availability-policy i optimizer står fast: `available` 100 %, `returning` 85 %, `questionable` 60 %, og `out`/`long_term`/`not_in_lineup` ekskluderes. Availability-gaten er ikke svekket.
- Compatibility-RPC-ene `get_fantasy_xfp_round_horizons_v1` og `get_fantasy_economy_v1`, som ble introdusert under sluttbrukerforsøket, er nå eksplisitt admin-only via server-side admincheck. `anon` har ikke EXECUTE.

## Aktivt område / neste kobling

MP-02 preseason-rosterkontroll er produksjonsverifisert mot EliteProspects: 239/239 spillere, 0 mangler, 0 tvetydige, 0 lagavvik, 0 ekstra og 0 posisjonsavvik. Robust identitetsgate og løpende MP-02.6-drift beholdes.

MP-08.4 og MP-08.5 er produksjonsverifisert. Det kanoniske featurelaget og den raske xFP-/anbefalingskjeden er stabilt for videre fantasyarbeid. Fixture-/motstanderratingen bruker ordinær 2025/26-baseline og kontrollert overgang til live 2026/27-data uten treningskampstatistikk.

MP-03.6 er ferdig og produksjonsverifisert som V4.6.2. Prisuniverset er nå komplett 239/239 og konsistent mellom spillerpool, låste sesongpriser og lagrede preseason-lag.

MP-04.7 er ferdig på `main`. «Mitt lag» gjenbruker `fantasy_rounds` + `get_fantasy_round_schedule_v1`, velger effektiv transfer-runde når den finnes og ellers neste deadline, normaliserer kampklubber med felles `canonicalFantasyTeam()`, og viser 0/1/flere kamper med H/B direkte under spillerens klubb/posisjon. Produksjonsdata bekrefter både runder med lag uten kamp og runder med dobbeltkamper.

**MP-04.5 + MP-04.6 er ferdig på `main` og produksjonssmoket 2026-08-23.** Transfermodellen er låst til 2 per ordinær runde uten bank/hits, 4 med Bytteboost, med server-side deadline/snapshot/event-gater. Transferhistorikk-RPC er migrert i Supabase og read-only produksjonskontroll bekrefter at RPC, Event Week-blokk og Bytteboost commit-gate finnes. `/fantasy/transfers` er lagt inn i hovednavigasjonen. Vercel-deploy for implementasjonen er grønn.

**MP-07.6 er ferdig og produksjonsverifisert 2026-08-23.** Regelspesifikasjon, datamodell, sikre booster-/event-RPC-er, eventlag, snapshots, scoring, Bytteboost, UI, leaderboard-historikk og filbasert regresjonsdekning er på `main`. Under implementeringen ble en faktisk produksjonsskjema-mismatch i spiller-rundepoeng oppdaget og reparert; aktiv scoringfunksjon er verifisert schema-aligned (`PASS`).

**MP-07.7 er ferdig og produksjonsverifisert 2026-08-23.** Snapshotspillerne fryser spillernavn, ny authenticated-only `get_my_fantasy_round_history_v1` er autoritativ snapshot-first lesemodell, score er valgfri `LEFT JOIN`-kontekst, og UI-et viser låste/uscorede så vel som ferdigscorede runder med to rekker, C/VC, priser, lagverdi, boost/event og relevante transfers. Read-only produksjonskontroll bekrefter `snapshot_first=true`, `avoids_current_team=true`, `score_left_join=true`, `authenticated_execute=true`, `anon_execute=false`. Produksjonen hadde 0 2026/27-snapshots under kontrollen, og ingen falske snapshot-/lag-/poengdata ble opprettet. Vercel-deploy for sluttimplementasjonen er `SUCCESS`.

MP-09-kjernen er produksjonsverifisert. Kun admin-godkjent availability påvirker analyse/optimizer, og blokkerte statuser kan ikke foreslås. Varslingskjeden er teknisk produksjonsverifisert og første naturlige E2E via et reelt nytt review-funn tas når et slikt funn oppstår.

**MP-10.1 + MP-10.2 + MP-10.5 er ferdig på `main` og produksjonsverifisert 2026-08-23.** Optimizeren er nå eksplisitt admin-only: offentlig side og API er fjernet, vanlig Fantasy-meny eksponerer den ikke, og compatibility-RPC-ene har admincheck. Vercel på admin-only-endringen er grønn.

**Neste operative hovedpunkt er Chat 07 – MP-07.8 + MP-07.9.** MP-07.7 gir nå et deterministisk snapshot-first historikkgrunnlag som personlig statistikkdashboard og sesonginnsikt kan bygges på uten å rekonstruere historiske lag fra dagens tilstand.

## Testing

- GitHub Actions kjører `npm run test:mp04:transfers`, `npm run test:mp07:bonus-weeks`, `npm run test:mp07:round-history` og `npm run test:mp10:optimizer` før `npm run build` på push/PR mot `main`.
- MP-04 transferregresjonen er deterministisk og filbasert og skriver aldri til Supabase. Den beskytter kontrakter for 2-byttegrense, ingen bank/hits, serverlagring, Event Week-sperre, Bytteboost, deadline/snapshot-gate, transferhistorikk og navigasjon/UI.
- Bonus Weeks-regresjonen er deterministisk og filbasert og skriver aldri til Supabase. Den beskytter kritiske kontrakter for eventlag-isolasjon, 200m/70m, booster inventory/stacking/deadline, snapshotmetadata, Kapteins-/Rekkeboost, double-GW-summering, Bytteboost, Event Week-transfer-sperre og historikkmarkører.
- MP-07.7 rundehistorikkregresjonen er deterministisk og filbasert og skriver aldri til Supabase. Den beskytter snapshot-first-kontrakten, frosset spillernavn, score som `LEFT JOIN`, fravær av current-team-rekonstruksjon, transferledger som kontekst, Event Week-isolasjon, authenticated-only RPC, to rekker og støtte for låste/uscorede snapshots.
- MP-10 optimizerregresjonen er deterministisk og filbasert og skriver aldri til Supabase. Den beskytter nå admin-only-kontrakten: ingen offentlig optimizer-side/API/navigasjon, adminverktøyet beholdes, compatibility-RPC-er har admincheck, og locked-player/0-2-4/Bytteboost/Event Week/availability/strategireglene beholdes.
- MP-07.7 produksjonskontroll: `get_my_fantasy_round_history_v1(text,uuid)` finnes med snapshot-first source, ingen `fantasy_user_team_players`, score via `LEFT JOIN`, authenticated EXECUTE og ingen anon EXECUTE. Snapshot-tabellene hadde 0 rader for 2026/27 ved kontrollen, så verifikasjonen gjorde ingen produksjonswrites. Sluttcommit `13eab6055f55e9b0a545233746cccd33aee2d79c` er Vercel-verifisert `SUCCESS`.
- Produksjonsendringen som fjernet offentlig optimizer-side/API er Vercel-verifisert `SUCCESS` 2026-08-23.
- MP-10 Supabase-hardening er migrert i produksjon: compatibility-RPC-ene krever autentisert admin og `anon` har ikke EXECUTE. Ingen lag-, transfer- eller poengdata ble skrevet under verifikasjonen.
- MP-04 produksjonssmoke: `get_my_fantasy_transfer_history_v1(text)` finnes, aktiv `apply_fantasy_transfers_v1` har Event Week-blokk og Bytteboost commit-gate, og kontrollen gjorde ingen writes til 2026/27-data. Vercel-build/deploy er grønn.
- Siste MP-07.6L-commit `fb9ee0a` er Vercel-verifisert `SUCCESS` 2026-08-23.
- Schema-reparasjonen for Bonus Weeks-scoring ble manuelt kjørt i Supabase og read-only verifisert med `scoring_schema_alignment = PASS`.
- Isolerte E2E-/testkontroller er implementert for sentrale fantasyflyter, blant annet snapshots og leaderboard.
- MP-04.7 er build-/Vercel-verifisert på `main`. Produksjonsdata viser 45 autoritative fantasy-runder; runde 7/9/20/24 har bare 8 deltakende lag (0 kamper for to lag), mens runde 11/13/14/39 har lag med 2 kamper. Linus Pettersson er `Stavanger · W`, og runde 1 har Stavanger borte mot Vålerenga. Responsive CSS lar fixturelinjen brytes på mobil uten å endre eksisterende lagbygger-grid.
- MP-08.4-produksjonssmoke: featurelag 234 rader, xFP-horisont 234 rader og anbefalingsdatasett 234 rader ved opprinnelig kontroll; API-endringen er Vercel-build/deploy-verifisert.
- MP-08.5-produksjonskontroll: 225 ordinære 2025/26-kamper brukt til historisk baseline, 0 ferdigspilte 2026/27-kamper ved kontrolltidspunktet, posisjonslogikk verifisert og autoritativ faktor kontrollert uten preseason-/treningskampavhengighet. Vercel-build er grønn.
- MP-03.6-produksjonskontroll: V4.6.2 har 239 publikasjonrader/current-roster-spillere, 14 faktiske prisendringer, 0 prislag-avvik, 239 kjøpbare spillere, 0 stale `purchase_price` og 0 eksisterende lag over 100m. Merge-/produksjonsdeploy er grønn.
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