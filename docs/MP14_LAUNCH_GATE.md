# MP-14 – Endelig launch-gate EHL 2026/27

Sist oppdatert: 2026-08-25

Dette dokumentet er det sporbare kontrollregisteret for MP-14.1–MP-14.7. GitHub `main` og faktisk produksjonsstatus er source of truth. En funksjon markeres ikke PASS bare fordi den finnes.

Statusverdier: **PASS / FAIL / BLOCKED / N/A**.

## Samlet gate

| MP-punkt | Område | Resultat | Bevis/verifikasjon | Blocker |
| --- | --- | --- | --- | --- |
| MP-14.1 | Endelig Fantasy-regelverk | **PASS** | `main`, brukersynlig regelbok, produksjons-RPC-er og direkte produksjonsquery av `fantasy_season_rules` + `fantasy_event_weeks`, verifisert 2026-08-25 | Ingen |
| MP-14.2 | Spillerpool, lag, posisjoner og priser | BLOCKED | Ikke sluttverifisert i MP-14 ennå | Må gjennomføres |
| MP-14.3 | Alle 45 gameweeks og deadlines | BLOCKED | Ikke sluttverifisert i MP-14 ennå | Må gjennomføres |
| MP-14.4 | Scoring, snapshots og leaderboard | BLOCKED | Ikke sluttverifisert i MP-14 ennå | Må gjennomføres |
| MP-14.5 | Produksjonsmiljø | BLOCKED | Ikke sluttverifisert i MP-14 ennå | Må gjennomføres |
| MP-14.6 | Mobil/desktop smoke-test | BLOCKED | Ikke sluttverifisert i MP-14 ennå | Må gjennomføres |
| MP-14.7 | Backup, rollback og adminrutiner | BLOCKED | Ikke sluttverifisert i MP-14 ennå | Må gjennomføres |

## MP-14.1 – Endelig Fantasy-regelverk

| Kontroll | Resultat | Bevis/verifikasjon | Blocker |
| --- | --- | --- | --- |
| Ordinært budsjett 100m | PASS | Produksjonsvalidering + publisert regelbok | Ingen |
| 12 spillere / 6F-4D-2G | PASS | Server-side lag-/transfer-/snapshotvalidering | Ingen |
| To rekker, hver 3F-2D-1G | PASS | Snapshot- og eventlagvalidering | Ingen |
| Maks 3 spillere per klubb | PASS | `fantasy_season_rules.max_players_per_club = 3` i produksjon | Ingen |
| Kaptein ×2 | PASS | Produksjonsregel + scoringmotor | Ingen |
| Visekaptein ×1,5 | PASS | Produksjonsregel + scoringmotor | Ingen |
| Maks 2 permanente transfers per ordinær runde | PASS | `max_transfers_per_round = 2` + server-side transfer-RPC | Ingen |
| Ingen transferbank / ingen poengtrekk | PASS | Per-runde transferledger; over grensen avvises | Ingen |
| Bytteboost opptil 4 | PASS | Produksjons-RPC øker grensen til 4 ved aktiv transfer_boost | Ingen |
| Deadline = første kampstart | PASS | Autoritativ `deadline_at` og publisert regel | Ingen |
| Immutable snapshot som historisk fasit | PASS | Produksjons-snapshotfunksjon fryser lag/regler | Ingen |
| Faste spillerpriser 2026/27 | PASS | Lag/transfers/events bruker låste sesongpriser | Ingen |
| GW15 Rik Onkel 200m | PASS | Produksjon: `rich_uncle`, GW15, 200m, publisert | Ingen |
| GW22 Julebord begge rekker 100 % | PASS | Produksjon: `christmas_party`, GW22; snapshot override 1,00 | Ingen |
| GW38 Fattig Onkel 70m | PASS | Produksjon: `poor_uncle`, GW38, 70m, publisert | Ingen |
| Personlige boostere vs Event Weeks | PASS | Produksjonsfunksjoner avviser konflikt | Ingen |
| Permanente transfers i Event Weeks | PASS | Produksjons transfer-RPC sperrer Event Week | Ingen |
| Intern regel-dokumentasjon samsvarer | PASS | `FANTASY_BONUS_WEEKS_RULES.md` og `MP07_JULEBORD_2026_27.md` korrigert 2026-08-25 | Ingen |

### MP-14.1 konklusjon

**PASS** – kode, produksjonsdatabase, brukersynlige regler og intern regel-dokumentasjon er samstemt for launch-gaten.

## GO LIVE

MP-14.8 skal **ikke** gjennomføres automatisk. Selv når MP-14.1–MP-14.7 er PASS, kreves eksplisitt godkjenning fra produkteier før GO LIVE.