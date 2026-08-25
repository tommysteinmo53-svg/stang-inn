# MP-14 – Endelig launch-gate EHL 2026/27

Sist oppdatert: 2026-08-25

Dette dokumentet er det sporbare kontrollregisteret for MP-14.1–MP-14.7. GitHub `main` og faktisk produksjonsstatus er source of truth. En funksjon markeres ikke PASS bare fordi den finnes.

Statusverdier: **PASS / FAIL / BLOCKED / N/A**.

## Samlet gate

| MP-punkt | Område | Resultat | Bevis/verifikasjon | Blocker |
| --- | --- | --- | --- | --- |
| MP-14.1 | Endelig Fantasy-regelverk | **PASS** | `main`, brukersynlig regelbok, produksjons-RPC-er og direkte produksjonsquery av `fantasy_season_rules` + `fantasy_event_weeks`, verifisert 2026-08-25 | Ingen |
| MP-14.2 | Spillerpool, lag, posisjoner og priser | **PASS** | `main`, versjonert EliteProspects-rosterfasit og direkte produksjonsquery av `fantasy_players`, `fantasy_player_season_prices`, admin-kø og aktive guards, verifisert 2026-08-25 | Ingen |
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

## MP-14.2 – Spillerpool, lag, posisjoner og priser

Preseason roster-fasit i `lib/fantasy/eliteprospects-roster-2026.ts` er eksplisitt versjonert og verifisert mot EliteProspects 2026/27 den 2026-08-16. HockeyLive/NIF brukes fortsatt som viktig identitets- og kampdatakilde, men den eldre NIF-preflighten på 244 spillere er ikke lenger autoritativ for preseason-medlemskap. Den gjeldende EP-fasiten består av 239 spillere.

| Kontroll | Resultat | Bevis/verifikasjon | Blocker |
| --- | --- | --- | --- |
| Gjeldende rosterstørrelse | PASS | 239 `on_current_roster`; samsvarer med versjonert EP-fasit | Ingen |
| Alle 10 EHL-lag representert | PASS | Produksjon: Frisk Asker 23, Lillehammer 22, Narvik 24, Nidaros 23, Ringerike 24, Sparta 25, Stavanger 25, Stjernen 25, Storhamar 25, Vålerenga 23 | Ingen |
| Aktive spillere | PASS | 239/239 current-roster-spillere er `active=true` | Ingen |
| Kjøpbar spillerpool | PASS | 239/239 current-roster-spillere er `available_for_purchase=true` | Ingen |
| External ID / identitet | PASS | 0 current-roster-spillere mangler `external_id`; 0 dupliserte external IDs i current roster | Ingen |
| Navn og klubb | PASS | 0 mangler navn, 0 mangler klubb, 0 dupliserte navn+klubb-rader | Ingen |
| Gyldige posisjoner | PASS | 37 C, 103 W, 78 D, 21 G; 0 posisjoner utenfor C/W/D/G | Ingen |
| Låst 2026/27-pris for hele rosteren | PASS | 239/239 current-roster-spillere har rad i `fantasy_player_season_prices` | Ingen |
| Prisrader låst | PASS | 0 av sesongens prisrader har `locked_at is null` | Ingen |
| Prisverdi gyldig | PASS | 0 null/ikke-positive priser; produksjonsintervall 1.00m–19.00m | Ingen |
| Pris-speil samsvarer | PASS | 0 avvik mellom `fantasy_players.price` og låst 2026/27-pris for current roster | Ingen |
| Uavklart pris/admin-kø | PASS | 0 pending i `fantasy_player_admin_queue` for 2026/27 | Ingen |
| Kjøpsguard aktiv | PASS | `fantasy_user_team_players_purchase_guard` er aktiv og avviser spillere som ikke er kjøpbare | Ingen |
| Fastprisguard aktiv | PASS | Guards på både `fantasy_player_season_prices` og `fantasy_players.price` er aktive | Ingen |
| Historiske/utgåtte spillere | PASS | Roster-sync sletter ikke historikk; spillere utenfor current roster gjøres ikke kjøpbare | Ingen |

### MP-14.2 konklusjon

**PASS** – den autoritative preseason-spillerpoolen er konsistent i produksjon, alle 239 nåværende spillere har gyldig identitet, klubb, posisjon og låst pris, ingen nåværende spiller står i pris-/admin-kø, og server-side guards hindrer kjøp av utilgjengelige spillere og endring av faste sesongpriser etter sesongstart.

## GO LIVE

MP-14.8 skal **ikke** gjennomføres automatisk. Selv når MP-14.1–MP-14.7 er PASS, kreves eksplisitt godkjenning fra produkteier før GO LIVE.