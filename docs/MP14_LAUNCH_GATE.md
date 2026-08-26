# MP-14 – Endelig launch-gate EHL 2026/27

Sist oppdatert: 2026-08-26

Sporbart kontrollregister for MP-14.1–MP-14.7. GitHub `main` og faktisk produksjonsstatus er source of truth. Statusverdier: **PASS / FAIL / BLOCKED / N/A**.

## Samlet gate

| MP-punkt | Område | Resultat | Bevis/verifikasjon | Blocker |
| --- | --- | --- | --- | --- |
| MP-14.1 | Endelig Fantasy-regelverk | **PASS** | Produksjonsregler, kode og publiserte regler verifisert 2026-08-25 | Ingen |
| MP-14.2 | Spillerpool, lag, posisjoner og priser | **PASS** | 239-spillers autoritativ preseason-pool og låste priser verifisert i produksjon 2026-08-25 | Ingen |
| MP-14.3 | Alle 45 gameweeks og deadlines | **PASS** | 45/45 runder, 225/225 kamper, unike koblinger, deadlines, Event Weeks og isolert E2E verifisert 2026-08-25 | Ingen |
| MP-14.4 | Scoring, snapshots og leaderboard | **PASS** | Produksjons-E2E for snapshot/scoring/transfers/DGW/Event Weeks/rundehistorikk/leaderboard + grønn CI og Vercel verifisert 2026-08-25 | Ingen preseason-blocker; MP-06.6 live kampdatavalidering gjenstår når representative seriekamper finnes |
| MP-14.5 | Produksjonsmiljø | **PASS** | Vercel-status, Supabase health, aktiv 5-min synk, env-/secret-kontrakt, retry/fail-closed, RLS/auth, grønn CI/build og 0 syntetiske rester verifisert 2026-08-25 | Ingen |
| MP-14.6 | Mobil/desktop smoke-test | **PASS** | Faktisk produksjon gjennomgått manuelt av produkteier på desktop og mobil 2026-08-26. Ett mobilavvik i Mitt lag/Spillermarked ble rettet på `main`, deployet med grønn CI/Vercel og visuelt re-verifisert. Øvrige hovedflater godkjent på mobil. | Ingen |
| MP-14.7 | Backup, rollback og adminrutiner | **PASS** | Supabase Pro backup-forutsetning, Vercel rollback, database-repair/restore-prinsipp, adminverktøy og eksplisitt incident recovery-runbook verifisert 2026-08-26 | Ingen |

## MP-14.1 – Endelig Fantasy-regelverk

**PASS.** Ordinært budsjett 100m, 12 spillere / 6F-4D-2G, to rekker, maks tre per klubb, C×2/VC×1,5, to permanente transfers, Bytteboost opptil fire, ingen bank/hits, deadline/snapshot, faste priser og Event Week-regler er samstemt mellom produksjonskode, database og publiserte regler. GW15 = Rik Onkel 200m, GW22 = Julebord, GW38 = Fattig Onkel 70m.

## MP-14.2 – Spillerpool, lag, posisjoner og priser

**PASS.** Autoritativ preseason-roster består av 239 spillere. 239/239 current-roster-spillere er aktive og kjøpbare med identitets-ID, klubb, gyldig posisjon og låst 2026/27-pris. Ingen duplikater, tvetydigheter eller prisavvik ble funnet.

## MP-14.3 – Alle 45 gameweeks og deadlines

**PASS.** Produksjonen har 45/45 Fantasy-runder og 225/225 autoritative kamper. Ingen manglende eller dupliserte kampkoblinger. Deadline er første kampstart i alle runder. GW15, GW22 og GW38 er korrekt koblet. Flyttede kamper kan rekalkulere kalender før snapshots; historiske snapshots beskytter mot feilaktig deadline-flytting.

## MP-14.4 – Scoring, snapshots og leaderboard

**PASS for preseason launch-gaten.** Isolerte produksjons-E2E-kontroller er grønne for snapshot/idempotens, C×2/VC×1,5, rekke 2, Bonus Weeks, Event Weeks, DGW/blank week, transfers, transferledger, rundedetaljer, rundehistorikk, leaderboard/tie-break, lagnavn + eiernavn og felles miniligaer. Testdata ble ryddet og ekte 2026/27-data ble ikke endret. MP-06.6 live kampdatavalidering gjenstår når representative 2026/27-seriekamper finnes og er ikke lukket av denne preseason-gaten.

## MP-14.5 – Produksjonsmiljø

**PASS.** Supabase er `ACTIVE_HEALTHY`. Ved kontroll var HockeyLive-synken stabil uten feil, GitHub cron kjører hvert 5. minutt med retry/timeout, `/api/sync-ehl` er fail-closed, sensitive kontrollerte RPC-er er auth/admin/service-gatet, GitHub Actions/Vercel er grønne og ingen syntetiske testrester ligger i produksjon.

## MP-14.6 – Mobil/desktop smoke-test

**PASS.** Faktisk produksjonsprodukt ble gjennomgått manuelt av produkteier 2026-08-26 på desktop og mobil. Desktop-smoken av landing/navigation, Fantasy, transfers, leaderboard/runder/historikk, miniligaer, Tipping, Event Weeks og analyseflater ble godkjent. På mobil ble det funnet ett konkret launch-avvik i `Mitt lag → Spillermarked`: lange spillernavn ble avkortet slik at spilleren ikke kunne identifiseres tydelig. Avviket ble rettet på `main` i commit `dd325d4` ved å gi spillernavnet lesbar mobilplass og flerl linje-layout uten å endre desktop. GitHub Actions og Vercel er grønne på fixen, og produkteier re-verifiserte visuelt at løsningen ser riktig ut. Deretter ble øvrige mobile hovedflater gjennomgått og godkjent uten nye launch-blockere.

## MP-14.7 – Backup, rollback og adminrutiner

**PASS.** Operativ recovery er verifisert og samlet i `docs/MP01_PRODUCTION_RUNBOOK.md`.

| Kontroll | Resultat | Bevis/verifikasjon | Blocker |
| --- | --- | --- | --- |
| Supabase backup | PASS | Produksjonsorganisasjonen er Pro. Supabase Pro har managed daglige databasebackups med standard syv dagers retensjon. Restore er dokumentert som kontrollert nedetidsoperasjon. | Ingen |
| PITR | N/A | Ikke et preseason launch-krav. Kan aktiveres senere dersom lavere RPO enn daglig backup blir nødvendig. | Ingen |
| Kode/deploy rollback | PASS | Runbook bruker siste kjente grønne Vercel-deploy eller kontrollert Git-revert; force-push skal ikke brukes. Vercel bevarer immutable deployments og støtter rollback/promote. | Ingen |
| Databaseendringer | PASS | Fremoverrettet migrasjon er standard repair. Full restore brukes kun ved reelt datatap/korrupsjon; koderollback antas aldri å rulle DB tilbake. | Ingen |
| Roster-/kampdatasynkfeil | PASS | Fail-closed sync, `sync_runs`/GitHub/Supabase-logger, roster-audit/preflight og idempotent re-sync er eksplisitt recovery-rutine. | Ingen |
| Feil scoring | PASS | Årsak korrigeres før rescore; leaderboard/lagpoeng skal ikke håndredigeres som første tiltak. Re-verifisering går spillerpoeng → lagpoeng → rundehistorikk → leaderboard. | Ingen |
| Feil snapshots/deadline | PASS | Snapshot behandles som historisk fasit. Før snapshot brukes autoritativ kalender-sync; etter snapshot kreves eksplisitt dokumentert repair/migrasjon og full etterkontroll. | Ingen |
| Feil Event Week | PASS | Før snapshot korrigeres target-GW/type/budsjett via eksisterende admin-/RPC-gate; etter snapshot/scoring behandles endringen som historisk datarepair med rescore/etterkontroll. | Ingen |
| Admininngrep | PASS | Fantasy-admin tilbyr roster-audit, player queue/priser, rundeverktøy, roster/HockeyLive-diagnostikk, scoring-backtest og sesongvalidering. Adminrutene er auth/admin-gatet. | Ingen |
| Kritisk feil etter launch | PASS | Runbook har eksplisitt incident-sekvens: klassifiser → stopp propagasjon → rollback kode eller repair/restore data → behold auth/RLS → verifiser end-to-end før normal drift. | Ingen |

### MP-14.7 konklusjon

**PASS.** Det finnes en forsvarlig og eksplisitt operativ plan for backup, kode-/deploy-rollback, database-repair/restore, synkfeil, scoringfeil, snapshotfeil, Event Week-feil og admininngrep. Planen prioriterer dataintegritet, sporbare migrations/repairs og eksisterende autoritative admin-/scoring-/snapshotgater fremfor ad-hoc produksjonsendringer.

## Samlet status før GO LIVE

MP-14.1–MP-14.7 er **PASS**. Ingen preseason launch-blockere er åpne. MP-06.6 live kampdatavalidering står eksplisitt igjen som sesongavhengig oppfølging når representative 2026/27-seriekamper finnes.

Samlet launch-status er **🟢 READY FOR GO LIVE**.

## GO LIVE

MP-14.8 skal **ikke** gjennomføres automatisk. Selv når MP-14.1–MP-14.7 er PASS, kreves eksplisitt godkjenning fra produkteier før GO LIVE.