# MP-14 – Endelig launch-gate EHL 2026/27

Sist oppdatert: 2026-08-26

Sporbart kontrollregister for MP-14.1–MP-14.8. GitHub `main` og faktisk produksjonsstatus er source of truth. Statusverdier: **PASS / FAIL / BLOCKED / N/A**.

## Samlet gate

| MP-punkt | Område | Resultat | Bevis/verifikasjon | Blocker |
| --- | --- | --- | --- | --- |
| MP-14.1 | Endelig Fantasy-regelverk | **PASS** | Produksjonsregler, kode og publiserte regler verifisert | Ingen |
| MP-14.2 | Spillerpool, lag, posisjoner og priser | **PASS** | 239/239 kjøpbare current-roster-spillere har låst pris/external ID. Purchase-gate-konsistens: 239/239 godtas; 10/10 historiske price-only/non-current avvises og skjules fra markedet. | Ingen |
| MP-14.3 | Alle 45 gameweeks og deadlines | **PASS** | 45/45 runder og 225/225 kampkoblinger verifisert | Ingen |
| MP-14.4 | Scoring, snapshots og leaderboard | **PASS** | Preseason E2E/regresjoner grønne | MP-06.6 live kampdatavalidering står planlagt åpen |
| MP-14.5 | Produksjonsmiljø | **PASS** | Supabase healthy, synk stabil, CI/Vercel grønne | Ingen |
| MP-14.6 | Mobil/desktop smoke-test | **PASS** | Produksjon gjennomgått og launch-fikser re-verifisert | Ingen |
| MP-14.7 | Backup, rollback og adminrutiner | **PASS** | Runbook/recovery verifisert | Ingen |
| MP-14.8 | GO LIVE | **PASS** | Ny eksplisitt produkteiergodkjenning mottatt 2026-08-26 etter purchase-consistency-fixen. Pre-flight ble kjørt på siste `main` før markering. | Ingen |

## MP-14.2 – purchase-consistency blocker

Launch-gaten ble reåpnet da et gyldig 12/12-lag kunne inneholde **Gustavs Arnis**, som hadde låst 2026/27-pris men korrekt `on_current_roster=false` og `available_for_purchase=false`. Spillermarkedet brukte tidligere «har sesongpris» som markedsfilter, mens serverens purchase-guard brukte autoritativ kjøpbarhetsstatus.

Fixen beholdt servergaten uendret og gjorde klienten konsistent med `active + on_current_roster + available_for_purchase`. Full produksjonsprobe viste **239/239 kjøpbare godkjent** og **10/10 ikke-kjøpbare avvist**. Rollback-only 12/12-lagring mot faktisk `save_fantasy_team_v3` lyktes uten endring av eksisterende lag/snapshots/transfers. Produksjonseier bekreftet deretter manuelt at faktisk lagring fungerer.

CI har egen `MP-14 purchase consistency regression`.

## MP-14.8 – GO LIVE

**PASS – endelig godkjent og gjennomført 2026-08-26 etter reåpnet launch-gate.**

Kontrollert sekvens:

1. Ny eksplisitt GO LIVE-godkjenning ble mottatt etter at purchase-consistency-blockeren var lukket og manuelt produksjonsverifisert.
2. Siste `main` før GO LIVE var `b7e612b1967a441bba901f9a6732ada095337a56`. De nyere commitene etter purchase-fixen gjaldt MP-10 admin-only/transfer-gate-korrigering og dokumentasjon; siste Build var `success` og Vercel var `success`.
3. Produksjonsintegritet ble kontrollert på nytt: **45 runder, 225 kampkoblinger, 239 kjøpbare current-roster-spillere, 249 historiske/current sesongprisrader, tre publiserte Event Weeks og 0 snapshots før sesongstart**.
4. Fersk HockeyLive-synk ble kontrollert: de fem siste observerte kjøringene var `ok=true`, uten `error_message`, med 225 importerte kamper.
5. Ingen separat launch-/maintenance-featureflag måtte åpnes. Produksjonen kjørte allerede godkjent `main`; GO LIVE er derfor kontrollert operativ aksept, ikke en unødvendig redeploy eller funksjonsendring.
6. MP-06.6 beholdes eksplisitt åpen til representative ekte 2026/27-seriekamper finnes.

## Samlet status

**🟢 LIVE – MP-14.1–MP-14.8 PASS.**

Stang Inn EHL 2026/27 er overlevert til sesongbasert drift. Følg HockeyLive-synk, roster/kjøpbarhet, første deadlines/snapshots, første faktiske Fantasy-scoring og Tipping live-data. Ved incident brukes `docs/MP01_PRODUCTION_RUNBOOK.md`.

**MP-06.6 er fortsatt åpen.**