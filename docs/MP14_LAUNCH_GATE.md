# MP-14 – Endelig launch-gate EHL 2026/27

Sist oppdatert: 2026-08-26

Sporbart kontrollregister for MP-14.1–MP-14.8. GitHub `main` og faktisk produksjonsstatus er source of truth. Statusverdier: **PASS / FAIL / BLOCKED / N/A**.

## Samlet gate

| MP-punkt | Område | Resultat | Bevis/verifikasjon | Blocker |
| --- | --- | --- | --- | --- |
| MP-14.1 | Endelig Fantasy-regelverk | **PASS** | Produksjonsregler, kode og publiserte regler verifisert 2026-08-25 | Ingen |
| MP-14.2 | Spillerpool, lag, posisjoner og priser | **PASS** | 239/239 kjøpbare current-roster-spillere har låst pris/external ID. Full purchase-gate-konsistens re-verifisert 2026-08-26: alle 239 godtas av servergaten, mens alle 10 historiske price-only/non-current spillere avvises og skjules fra Spillermarkedet. | Ingen |
| MP-14.3 | Alle 45 gameweeks og deadlines | **PASS** | 45/45 runder, 225/225 kamper, unike koblinger, deadlines, Event Weeks og isolert E2E verifisert 2026-08-25 | Ingen |
| MP-14.4 | Scoring, snapshots og leaderboard | **PASS** | Produksjons-E2E for snapshot/scoring/transfers/DGW/Event Weeks/rundehistorikk/leaderboard + grønn CI og Vercel verifisert | Ingen preseason-blocker; MP-06.6 live kampdatavalidering gjenstår når representative seriekamper finnes |
| MP-14.5 | Produksjonsmiljø | **PASS** | Vercel-status, Supabase health, aktiv 5-min synk, env-/secret-kontrakt, retry/fail-closed, RLS/auth, grønn CI/build og 0 syntetiske rester verifisert | Ingen |
| MP-14.6 | Mobil/desktop smoke-test | **PASS** | Faktisk produksjon gjennomgått på desktop/mobil. Mobil spillermarked-readability ble rettet og re-verifisert. Purchase-consistency-launchfeilen ble i tillegg rettet 2026-08-26 og fikk egen CI-gate. | Ingen |
| MP-14.7 | Backup, rollback og adminrutiner | **PASS** | Supabase Pro backup-forutsetning, Vercel rollback, database-repair/restore-prinsipp, adminverktøy og eksplisitt incident recovery-runbook verifisert | Ingen |
| MP-14.8 | GO LIVE | **BLOCKED** | MP-14.1–MP-14.7 er re-verifisert PASS etter kjøpbarhetsfixen. | Krever ny eksplisitt godkjenning fra produkteier. MP-14.8 er ikke gjennomført etter at launch-gaten ble reåpnet. |

## MP-14.1 – Endelig Fantasy-regelverk

**PASS.** Ordinært budsjett 100m, 12 spillere / 6F-4D-2G, to rekker, maks tre per klubb, C×2/VC×1,5, to permanente transfers, Bytteboost opptil fire, ingen bank/hits, deadline/snapshot, faste priser og Event Week-regler er samstemt mellom produksjonskode, database og publiserte regler. GW15 = Rik Onkel 200m, GW22 = Julebord, GW38 = Fattig Onkel 70m.

## MP-14.2 – Spillerpool, lag, posisjoner og priser

**PASS etter reåpnet launch-kontroll 2026-08-26.** Autoritativ preseason-roster består av 239 spillere. 239/239 current-roster-spillere er aktive, `on_current_roster=true`, `available_for_purchase=true`, har external ID og låst 2026/27-pris. Ingen current-roster prisavvik ble funnet.

### Purchase-consistency blocker og rotårsak

En produksjonslagring feilet med `Player is not available for new fantasy purchases` selv om klienten viste laget som gyldig. Den konkrete spilleren var **Gustavs Arnis** (`f127b466-5a1b-418d-b113-00fcd027a133`). Han hadde låst 2026/27-pris 5.0m og `active=true`, men var korrekt satt `on_current_roster=false` og `available_for_purchase=false`. Separat MP-09 availability/skadestatus var tom og var ikke årsaken.

Produksjonen har totalt 249 prisrader for 2026/27: 239 current/kjøpbare spillere og 10 historiske spillere som fortsatt beholder låst sesongpris, men som ikke er current roster og ikke er kjøpbare. De 10 ble samlet markert ikke-current/ikke-kjøpbare i roster-reconciliationen 2026-08-17. Dette er korrekt datamodell; en låst historisk pris innebærer ikke kjøpbarhet.

Rotårsaken var klientlogikk i `app/fantasy/team/page.tsx`: Spillermarkedet brukte «har 2026/27-pris» som markedsfilter og lastet ikke `active`, `on_current_roster` eller `available_for_purchase`. Serverens `fantasy_user_team_players_purchase_guard` brukte derimot `available_for_purchase` og avviste korrekt nye inserts. Dermed var klient og server ikke på samme autoritative kjøpbarhetsregel.

Fixen på `main` gjør følgende uten å svekke servergaten:

- lagbyggeren laster `active`, `on_current_roster` og `available_for_purchase` sammen med spilleridentiteten;
- Spillermarkedet viser bare spillere som både har låst sesongpris og er `active + on_current_roster + available_for_purchase`;
- klientens laggyldighet krever samme kjøpbarhetsstatus, slik at et lag ikke lenger kan vises som «gyldig» med en ikke-kjøpbar spiller;
- et eksisterende lag som inneholder en spiller som senere er blitt ikke-kjøpbar kan fortsatt vise spilleren i oppstillingen, men spilleren markeres som «må erstattes» og kan fjernes; spilleren kan ikke legges inn på nytt fra markedet;
- serverens trigger `guard_fantasy_player_purchase_v1` er beholdt uendret.

Full produksjonsverifikasjon etter fix:

- den faktiske purchase-triggerfunksjonen ble koblet til en midlertidig probe-tabell: **239/239 kjøpbare spillere ble godkjent**;
- samme probe testet alle 10 price-only/non-current spillere: **10/10 ble avvist**, 0 feilaktig godkjent;
- rollback-only kall til den faktiske `save_fantasy_team_v3` med et gyldig 12/12-lag av kjøpbare spillere returnerte gyldig team-ID;
- før-/etter-fingerprint for eksisterende brukerlag var identisk, og snapshots, lagpoeng og transferbatcher var uendret;
- målrettet `test:mp14:purchases` er lagt i CI og verifiserer at klienten fortsatt bruker de autoritative kjøpbarhetsfeltene;
- GitHub Build og Vercel er grønne på fix-kjeden.

## MP-14.3 – Alle 45 gameweeks og deadlines

**PASS.** Produksjonen har 45/45 Fantasy-runder og 225/225 autoritative kampkoblinger. Ingen manglende eller dupliserte kampkoblinger. Deadline er første kampstart i alle runder. GW15, GW22 og GW38 er korrekt koblet. Flyttede kamper kan rekalkulere kalender før snapshots; historiske snapshots beskytter mot feilaktig deadline-flytting.

## MP-14.4 – Scoring, snapshots og leaderboard

**PASS for preseason launch-gaten.** Isolerte produksjons-E2E-kontroller er grønne for snapshot/idempotens, C×2/VC×1,5, rekke 2, Bonus Weeks, Event Weeks, DGW/blank week, transfers, transferledger, rundedetaljer, rundehistorikk, leaderboard/tie-break, lagnavn + eiernavn og felles miniligaer. Testdata ble ryddet og ekte 2026/27-data ble ikke endret. MP-06.6 live kampdatavalidering gjenstår når representative 2026/27-seriekamper finnes og er ikke lukket av denne preseason-gaten.

## MP-14.5 – Produksjonsmiljø

**PASS.** Supabase er `ACTIVE_HEALTHY`. HockeyLive-synken er stabil, GitHub cron kjører hvert 5. minutt med retry/timeout, `/api/sync-ehl` er fail-closed, sensitive kontrollerte RPC-er er auth/admin/service-gatet, GitHub Actions/Vercel er grønne og ingen syntetiske testrester ligger i produksjon.

## MP-14.6 – Mobil/desktop smoke-test

**PASS.** Faktisk produksjonsprodukt er gjennomgått på desktop og mobil. Tidligere mobilavvik i `Mitt lag → Spillermarked` rundt lange spillernavn ble rettet og visuelt re-verifisert. Den senere purchase-consistency-blockeren var funksjonell, ikke et nytt layoutproblem; den er nå lukket gjennom autoritativ markedskjøpbarhet og egen CI-gate.

## MP-14.7 – Backup, rollback og adminrutiner

**PASS.** Operativ recovery er verifisert og samlet i `docs/MP01_PRODUCTION_RUNBOOK.md`.

| Kontroll | Resultat | Bevis/verifikasjon | Blocker |
| --- | --- | --- | --- |
| Supabase backup | PASS | Produksjonsorganisasjonen er Pro. Supabase Pro har managed daglige databasebackups med standard syv dagers retensjon. Restore er dokumentert som kontrollert nedetidsoperasjon. | Ingen |
| PITR | N/A | Ikke et launch-krav. Kan aktiveres senere dersom lavere RPO enn daglig backup blir nødvendig. | Ingen |
| Kode/deploy rollback | PASS | Runbook bruker siste kjente grønne Vercel-deploy eller kontrollert Git-revert; force-push skal ikke brukes. | Ingen |
| Databaseendringer | PASS | Fremoverrettet migrasjon er standard repair. Full restore brukes kun ved reelt datatap/korrupsjon. | Ingen |
| Roster-/kampdatasynkfeil | PASS | Fail-closed sync, `sync_runs`/GitHub/Supabase-logger, roster-audit/preflight og idempotent re-sync er eksplisitt recovery-rutine. | Ingen |
| Feil scoring | PASS | Årsak korrigeres før rescore; leaderboard/lagpoeng håndredigeres ikke som første tiltak. | Ingen |
| Feil snapshots/deadline | PASS | Snapshot behandles som historisk fasit; historiske repairs krever eksplisitt kontrollert migrasjon/etterkontroll. | Ingen |
| Feil Event Week | PASS | Konfigurasjon korrigeres via eksisterende gater; historiske endringer behandles som datarepair med etterkontroll. | Ingen |
| Admininngrep | PASS | Fantasy-admin tilbyr nødvendige roster-, runde-, diagnose-, scoring- og sesongverktøy med auth/admin-gater. | Ingen |
| Kritisk feil etter launch | PASS | Runbook har eksplisitt incident-sekvens og bevarer auth/RLS og dataintegritet. | Ingen |

## MP-14.8 – GO LIVE

**BLOCKED / AWAITING APPROVAL.** Launch-gaten ble reåpnet 2026-08-26 da purchase-consistency-feilen ble funnet. Feilen er nå lukket og MP-14.1–MP-14.7 er igjen PASS, men en tidligere GO LIVE-markering skal ikke brukes som godkjenning etter reåpningen.

**MP-14.8 skal ikke gjennomføres før produkteier gir en ny eksplisitt GO LIVE-godkjenning etter denne verifikasjonen.**

MP-06.6 er fortsatt **åpen** og skal først lukkes etter full live-produksjonsvalidering mot representative ekte 2026/27-seriekamper.

## Samlet status

**🟢 READY FOR GO LIVE – AWAITING EXPLICIT APPROVAL.**

Ingen kjent teknisk launch-blocker står åpen i MP-14.1–MP-14.7. MP-14.8 er bevisst ikke gjennomført etter reåpningen.