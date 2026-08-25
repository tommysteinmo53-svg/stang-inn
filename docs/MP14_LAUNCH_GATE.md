# MP-14 – Endelig launch-gate EHL 2026/27

Sist oppdatert: 2026-08-25

Sporbart kontrollregister for MP-14.1–MP-14.7. GitHub `main` og faktisk produksjonsstatus er source of truth. Statusverdier: **PASS / FAIL / BLOCKED / N/A**.

## Samlet gate

| MP-punkt | Område | Resultat | Bevis/verifikasjon | Blocker |
| --- | --- | --- | --- | --- |
| MP-14.1 | Endelig Fantasy-regelverk | **PASS** | Produksjonsregler, kode og publiserte regler verifisert 2026-08-25 | Ingen |
| MP-14.2 | Spillerpool, lag, posisjoner og priser | **PASS** | 239-spillers autoritativ preseason-pool og låste priser verifisert i produksjon 2026-08-25 | Ingen |
| MP-14.3 | Alle 45 gameweeks og deadlines | **PASS** | 45/45 runder, 225/225 kamper, unike koblinger, deadlines, Event Weeks og isolert E2E verifisert 2026-08-25 | Ingen |
| MP-14.4 | Scoring, snapshots og leaderboard | **PASS** | Produksjons-E2E for snapshot/scoring/transfers/DGW/Event Weeks/rundehistorikk/leaderboard + grønn CI og Vercel verifisert 2026-08-25 | Ingen preseason-blocker; MP-06.6 live kampdatavalidering gjenstår når representative seriekamper finnes |
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

**PASS.** Produksjonen har 45/45 Fantasy-runder og 225/225 autoritative kamper med 0 manglende/dupliserte runder eller kampkoblinger. Deadline er første kampstart i alle runder. Flyttede kampstarter kan oppdatere kalenderen før snapshots, mens deadline-/kalenderflytting blokkeres når historiske snapshots finnes. GW15, GW22 og GW38 er korrekt koblet, og isolert deadline/snapshot-E2E er grønn uten varige testrester.

## MP-14.4 – Scoring, snapshots og leaderboard

Produksjonen er fortsatt i ren preseason-tilstand: 0 ekte 2026/27-snapshots, 0 lagpoeng, 0 spillerpoeng og 0 transferbatcher. Ett ekte brukerlag finnes. Launch-verifikasjonen er derfor gjennomført med isolerte syntetiske fixtures som rydder seg selv og eksplisitt kontrollerer at ekte 2026/27-data ikke endres.

| Kontroll | Resultat | Bevis/verifikasjon | Blocker |
| --- | --- | --- | --- |
| Snapshot opprettes og er idempotent | PASS | `run_mp12_snapshot_freeze_e2e_v1`: 4/4 | Ingen |
| Snapshot fryser 12 spillere / 6F-4D-2G / to rekker | PASS | Produksjons-E2E | Ingen |
| Snapshot fryser C/VC | PASS | Produksjons-E2E | Ingen |
| Rundeautomatisering | PASS | `run_mp12_round_automation_e2e_v2`: 5/5 | Ingen |
| Uferdig kamp scores ikke | PASS | Rundeautomatisering E2E | Ingen |
| Delvis materialiserte spillerpoeng blokkerer lagscore | PASS | Rundeautomatisering E2E | Ingen |
| Komplett spillerpoenggrunnlag scorer runden | PASS | Rundeautomatisering E2E | Ingen |
| Idempotent rescore | PASS | Rundeautomatisering E2E | Ingen |
| C×2 / VC×1,5 | PASS | `run_mp12_team_scoring_e2e_v1`: 5/5 | Ingen |
| Ordinær rekke 2 = 50 % | PASS | Produksjons-E2E | Ingen |
| Captain Boost ×2,5 | PASS | `run_mp12_bonus_event_e2e_v1`: 6/6 | Ingen |
| Rekkeboost = rekke 2 100 % | PASS | Produksjons-E2E | Ingen |
| Event Week blokkerer personlige boostere | PASS | Produksjons-E2E | Ingen |
| DGW summerer alle kamper | PASS | `run_mp12_dgw_blank_week_e2e_v1`: 4/4 | Ingen |
| Blank week gir 0 kamper / 0 poeng | PASS | Produksjons-E2E | Ingen |
| Permanente transfers 2 / Bytteboost 4 | PASS | `run_mp12_transfers_e2e_v2`: 6/6 | Ingen |
| Transferledger og atomisk commit | PASS | Produksjons-E2E | Ingen |
| Egen rundedetalj og spillernedbrytning | PASS | `run_fantasy_my_round_details_e2e_test`: 5/5 | Ingen |
| Rundedetalj er brukeravgrenset | PASS | Andre brukere får 0 rader i E2E | Ingen |
| Sesongleaderboard/tie | PASS | Kontrollert E2E: tre lag deler #1 med dense-rank; neste lag #2 | Ingen |
| Rundeleaderboard/tie | PASS | Kontrollert E2E: delt rundeseier og dense-rank | Ingen |
| Rundeseire | PASS | Delte vinnere telles korrekt | Ingen |
| Snitt/beste/siste runde | PASS | Kontrollert E2E | Ingen |
| Rundehistorikk | PASS | R1/R2/R3 posisjon og poeng verifisert | Ingen |
| Leaderboard-testcleanup | PASS | 0 testlag og 0 testrunder igjen etter kjøring | Ingen |
| Lagnavn + eiernavn | PASS | MP-07.10 CI-regresjon grønn; produksjon har 0 ufullstendige profiler og 0 ugyldige Fantasy-lagnavn | Ingen |
| Felles miniligaer | PASS | MP-13.6 CI 12/12; produksjon bruker kanonisk Stang Inn liga-/medlemsmodell | Ingen |
| Bonus/Event-dokumentasjonskontrakt | PASS | CI-feil på formulering ble rettet; permanentlaget bevares og gjenopptas etter Event Week | Ingen |
| GitHub Actions | PASS | Build run 1508: alle regresjoner + Next.js build grønne | Ingen |
| Vercel | PASS | Deployment-status `success` på samme `main`-commit | Ingen |
| Testisolasjon | PASS | Syntetiske fixtures ryddet; ekte 2026/27 runder/kamper/lag forble uendret | Ingen |

### MP-14.4 konklusjon

**PASS for preseason launch-gaten.** Snapshot-, scoring-, transfer-, Bonus/Event-, DGW/blank-week-, rundehistorikk- og leaderboardkjeden er behavioralt verifisert mot produksjonsfunksjoner med isolerte fixtures, og CI/Vercel er grønne.

**MP-06.6 er ikke lukket av dette punktet.** Live validering av HockeyLive-kampstatistikk og faktisk Fantasy-score mot representative 2026/27-seriekamper skal fortsatt gjennomføres når slike kamper finnes. Dette er en eksplisitt post-launch/live-verifikasjon og ikke en preseason-blocker så lenge den testede scoringmotoren og datakjeden er grønne.

## GO LIVE

MP-14.8 skal **ikke** gjennomføres automatisk. Selv når MP-14.1–MP-14.7 er PASS, kreves eksplisitt godkjenning fra produkteier før GO LIVE.