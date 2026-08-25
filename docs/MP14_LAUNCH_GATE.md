# MP-14 – Endelig launch-gate EHL 2026/27

Sist oppdatert: 2026-08-25

Sporbart kontrollregister for MP-14.1–MP-14.7. GitHub `main` og faktisk produksjonsstatus er source of truth. Statusverdier: **PASS / FAIL / BLOCKED / N/A**.

## Samlet gate

| MP-punkt | Område | Resultat | Bevis/verifikasjon | Blocker |
| --- | --- | --- | --- | --- |
| MP-14.1 | Endelig Fantasy-regelverk | **PASS** | Produksjonsregler, kode og publiserte regler verifisert 2026-08-25 | Ingen |
| MP-14.2 | Spillerpool, lag, posisjoner og priser | **PASS** | 239-spillers autoritativ preseason-pool og låste priser verifisert i produksjon 2026-08-25 | Ingen |
| MP-14.3 | Alle 45 gameweeks og deadlines | **PASS** | 45/45 runder, 225/225 kamper, unike koblinger, deadlines, Event Weeks og isolert E2E verifisert 2026-08-25 | Ingen |
| MP-14.4 | Scoring, snapshots og leaderboard | BLOCKED | Ikke sluttverifisert i MP-14 ennå | Må gjennomføres |
| MP-14.5 | Produksjonsmiljø | BLOCKED | Ikke sluttverifisert i MP-14 ennå | Må gjennomføres |
| MP-14.6 | Mobil/desktop smoke-test | BLOCKED | Ikke sluttverifisert i MP-14 ennå | Må gjennomføres |
| MP-14.7 | Backup, rollback og adminrutiner | BLOCKED | Ikke sluttverifisert i MP-14 ennå | Må gjennomføres |

## MP-14.1 – Endelig Fantasy-regelverk

**PASS.** Ordinært budsjett 100m, 12 spillere / 6F-4D-2G, to rekker, maks tre per klubb, C×2/VC×1,5, to permanente transfers, Bytteboost opptil fire, ingen bank/hits, deadline/snapshot, faste priser og Event Week-regler er samstemt mellom produksjonskode, database, publiserte regler og intern dokumentasjon.

Event Weeks i produksjon: GW15 Rik Onkel 200m, GW22 Julebord med begge rekker 100 %, GW38 Fattig Onkel 70m. Booster-/transferkonflikter håndheves server-side.

## MP-14.2 – Spillerpool, lag, posisjoner og priser

**PASS.** Den versjonerte EliteProspects-fasiten verifisert 2026-08-16 er autoritativ preseason-roster og består av 239 spillere. Den eldre 244-preflighten var HockeyLive/NIF og er ikke lenger autoritativ for preseason-medlemskap.

Produksjonskontroll: 239/239 current-roster-spillere er aktive og kjøpbare, alle har identitets-ID, navn, klubb, gyldig C/W/D/G-posisjon og låst 2026/27-pris. Det finnes ingen dupliserte current-roster-identiteter, ingen prisavvik og ingen ventende current-roster-saker i pris/admin-køen. Pris- og kjøpsguards er aktive.

## MP-14.3 – Alle 45 gameweeks og deadlines

NIHF har publisert EHL 2026/27-serieoppsettet i HockeyLive; prosjektets autoritative turnering er `448981`. Produksjonskalenderen er kontrollert direkte.

| Kontroll | Resultat | Bevis/verifikasjon | Blocker |
| --- | --- | --- | --- |
| Fantasy-runder 1–45 | PASS | 45 rader, 0 manglende og 0 dupliserte rundenummer | Ingen |
| 2026/27-kamper | PASS | 225 kamper | Ingen |
| Kampkoblinger | PASS | 225 koblinger / 225 distinkte kamper; 0 ukoblede og 0 fler-koblede kamper | Ingen |
| Kampidentiteter | PASS | 0 manglende og 0 dupliserte kamp-ID-er | Ingen |
| Runde-speil | PASS | 0 avvik mellom kampens Fantasy-runde og faktisk rundekobling | Ingen |
| Runde-start | PASS | 0 avvik mot tidligste kampstart | Ingen |
| Deadline | PASS | 45/45 = første kampstart; 0 avvik | Ingen |
| Runde-slutt | PASS | 0 runder avsluttes før siste kamp | Ingen |
| Sesongisolasjon | PASS | 0 kamp-/rundekoblinger på tvers av sesonger | Ingen |
| Flyttet kamp før snapshot | PASS | Rundesync rekalkulerer start/deadline/slutt fra faktisk kampstart | Ingen |
| Flyttet kamp etter snapshot | PASS | Deadline-flytting blokkeres dersom runden allerede har snapshot | Ingen |
| Kalender-rebuild etter snapshot | PASS | Rebuild blokkeres når sesongen har snapshots | Ingen |
| GW15 | PASS | 5 kamper, Rik Onkel 200m, deadline = første kampstart | Ingen |
| GW22 | PASS | 5 kamper, Julebord, deadline = første kampstart | Ingen |
| GW38 | PASS | 5 kamper, Fattig Onkel 70m, deadline = første kampstart | Ingen |
| Event Weeks | PASS | Nøyaktig tre, ingen dupliserte Event Week-runder | Ingen |
| Deadline/snapshot E2E | PASS | Eksisterende isolert produksjons-E2E: 5/5 kontroller grønn | Ingen |
| Testisolasjon | PASS | E2E beholdt produksjon uendret: 45→45 runder, 225→225 kamper, 0→0 score-rader | Ingen |

### MP-14.3 konklusjon

**PASS** – alle 45 Fantasy-runder og 225 autoritative kamper er konsistente i produksjon. Deadline er første kampstart for alle runder. Flyttede kampstarter kan oppdatere kalenderen før snapshots, mens historikken beskyttes etter snapshot. GW15, GW22 og GW38 er korrekt koblet, og den isolerte automatiseringstesten er grønn uten varige testrester.

## GO LIVE

MP-14.8 skal **ikke** gjennomføres automatisk. Selv når MP-14.1–MP-14.7 er PASS, kreves eksplisitt godkjenning fra produkteier før GO LIVE.