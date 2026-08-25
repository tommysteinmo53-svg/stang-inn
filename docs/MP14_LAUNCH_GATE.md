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
| MP-14.5 | Produksjonsmiljø | **PASS** | Vercel-status, Supabase health, aktiv 5-min synk, env-/secret-kontrakt, retry/fail-closed, RLS/auth, grønn CI/build og 0 syntetiske rester verifisert 2026-08-25 | Ingen |
| MP-14.6 | Mobil/desktop smoke-test | **BLOCKED** | MP-11.8 er dokumentert produksjonsverifisert på dagens `main`; CI/Vercel er grønne. Ny launch-smoke ble forsøkt 2026-08-25, men kontrollmiljøet blokkerer produksjons-URL i Chromium (`ERR_BLOCKED_BY_ADMINISTRATOR`), direkte web-åpning feilet og Vercel runtime-lesing returnerte 403. | Reell visuell desktop+mobil-smoke mot faktisk produksjon kan ikke gjennomføres fra tilgjengelig kontrollmiljø. Skal ikke markeres PASS uten ny faktisk browser-verifikasjon. |
| MP-14.7 | Backup, rollback og adminrutiner | BLOCKED | Ikke sluttverifisert i MP-14 ennå | Må gjennomføres |

## MP-14.1 – Endelig Fantasy-regelverk

**PASS.** Ordinært budsjett 100m, 12 spillere / 6F-4D-2G, to rekker, maks tre per klubb, C×2/VC×1,5, to permanente transfers, Bytteboost opptil fire, ingen bank/hits, deadline/snapshot, faste priser og Event Week-regler er samstemt mellom produksjonskode, database og publiserte regler. GW15 = Rik Onkel 200m, GW22 = Julebord, GW38 = Fattig Onkel 70m.

## MP-14.2 – Spillerpool, lag, posisjoner og priser

**PASS.** Autoritativ preseason-roster består av 239 spillere. 239/239 current-roster-spillere er aktive og kjøpbare med identitets-ID, klubb, gyldig posisjon og låst 2026/27-pris. Ingen duplikater, tvetydigheter eller prisavvik ble funnet.

## MP-14.3 – Alle 45 gameweeks og deadlines

**PASS.** Produksjonen har 45/45 Fantasy-runder og 225/225 autoritative kamper. Ingen manglende eller dupliserte kampkoblinger. Deadline er første kampstart i alle runder. GW15, GW22 og GW38 er korrekt koblet. Flyttede kamper kan rekalkulere kalender før snapshots; historiske snapshots beskytter mot feilaktig deadline-flytting.

## MP-14.4 – Scoring, snapshots og leaderboard

**PASS for preseason launch-gaten.** Isolerte produksjons-E2E-kontroller er grønne for snapshot/idempotens, C×2/VC×1,5, rekke 2, Bonus Weeks, Event Weeks, DGW/blank week, transfers, transferledger, rundedetaljer, rundehistorikk, leaderboard/tie-break, lagnavn + eiernavn og felles miniligaer. Testdata ble ryddet og ekte 2026/27-data ble ikke endret. MP-06.6 live kampdatavalidering gjenstår når representative 2026/27-seriekamper finnes og er ikke lukket av denne preseason-gaten.

## MP-14.5 – Produksjonsmiljø

**PASS.** Supabase er `ACTIVE_HEALTHY`. Siste 24 timer ved kontroll: 307/307 HockeyLive-sync-runs med `ok=true`, 0 feil og 0 `error_message`; ordinære synker importerer 225 kamper. GitHub cron kjører hvert 5. minutt og bruker retry/timeout. `/api/sync-ehl` er fail-closed. Sensitive kontrollerte RPC-er har ikke anon-EXECUTE og bruker auth/admin/service-gater der nødvendig. GitHub Actions og Vercel er grønne, og 0 syntetiske testrester finnes i produksjon. Secret-verdier er ikke eksponert.

## MP-14.6 – Mobil/desktop smoke-test

**BLOCKED.** Dette punktet krever en ny faktisk visuell sluttkontroll av produksjonsproduktet på både desktop og mobil etter MP-11.8.

Delbevis som er grønt:

- `docs/PROJECT_STATUS.md` på dagens `main` dokumenterer MP-11.8 som ferdigstilt og produksjonsverifisert med samlet shell/header/navigation, premium svart/gull branding, Stang Inn-logo/SI-mark, metadata/favicon/app-assets og konsistent mobil/desktop-presentasjon.
- Samme dags sluttregresjon er grønn for Fantasy, transfers, rundehistorikk, identitet, Event Weeks, miniligaer, Tipping og Next.js-build.
- Vercel status på dagens `main` er `success`.

Ny launch-smoke ble forsøkt mot `https://stang-inn-xi.vercel.app` med Chromium i 1440×1000 og 390×844 på landing, login/onboarding-relaterte flater, Fantasy, transfers, leaderboard/historikk, miniligaer, Tipping, Event Weeks, analyse og admin. Nettleseren ble stoppet av kontrollmiljøets policy med `ERR_BLOCKED_BY_ADMINISTRATOR` før siden kunne lastes. Direkte web-åpning fra tilgjengelig webverktøy feilet også, og Vercel runtime-lesing ga 403. Dette er ikke bevis på feil i Stang Inn, men det betyr at den nødvendige faktiske visuelle sluttkontrollen ikke kan dokumenteres fra dette miljøet.

### MP-14.6 konklusjon

**BLOCKED – ikke FAIL.** Ingen produktfeil er påvist. Blockeren er manglende tilgang til en faktisk produksjonsbrowser i kontrollmiljøet. Punktet skal først settes til PASS etter en ekte mobil- og desktop-smoke av produksjonsaliaset som minst dekker landing/navigation, onboarding, Fantasy lagbygger, transfers, leaderboard/runder/historikk, miniligaer, Tipping, Event Weeks, brukersynlige analyseflater, branding og relevante loading/error/empty states.

## GO LIVE

MP-14.8 skal **ikke** gjennomføres automatisk. Selv når MP-14.1–MP-14.7 er PASS, kreves eksplisitt godkjenning fra produkteier før GO LIVE.
