# Stang Inn – PROJECT STATUS

Sist kontrollert mot GitHub `main`: 2026-08-25

## Source of truth

- Teknisk sannhet: GitHub `main`.
- Prosjektplan/prioritering: `docs/MASTERPLAN.md` + gjeldende masterplan-addendum.
- Denne filen er et kort teknisk kontrollpunkt for nye arbeidsøkter/chatter.
- Eldre roadmap-filer skal ikke overstyre masterplan, addendum eller faktisk kode.

## Stack og drift

- Next.js 16.2.11 / React 19.2.0 / TypeScript 5.9.x.
- Supabase + Vercel.
- GitHub Actions build-CI med MP-01 produksjonsdrift, MP-12 scoring/security/test-isolation, MP-13 scoring/readiness/felles miniligaer, MP-04 transfer, Bonus Weeks, MP-07 rundehistorikk/stats/identitet/Event Weeks og MP-10 optimizer før build.
- Isolerte tester skal aldri endre ekte 2026/27-data og skal rydde egne syntetiske fixtures.
- **MP-01.6 produksjons-/driftsgaten er ferdigstilt og produksjonsverifisert 2026-08-25.** Operativ runbook: `docs/MP01_PRODUCTION_RUNBOOK.md`.
- Supabase-organisasjonen `Hockeytips` er verifisert på **Pro**, slik at managed-backup-forutsetningen er etablert før MP-14.
- HockeyLive-requester har intern timeout, og delvise sync-/Fantasy-livssyklusfeil gir `ok=false`/HTTP 500 slik at cron kan retry-e i stedet for å rapportere falsk suksess.

## Felles brukeridentitet

- **MP-01.7 er ferdigstilt og produksjonsverifisert 2026-08-24.** `public.players` er den generelle Stang Inn-profilen for Tipping, Fantasy, leaderboard og felles miniligaer.
- Ny/ufullstendig bruker må eksplisitt bekrefte profilnavn via `/onboarding`; Google-navn er kun forslag.
- `complete_stanginn_profile_v1(text)` er authenticated-only og servervaliderer profilnavnet. Direkte profilskriving for vanlige klienter er begrenset.

## EHL 2026/27

- Tournament ID `448981`.
- Preseason-spillerpool: 239/239 verifisert, 0 mangler, 0 tvetydige, 0 lag-/posisjonsavvik.
- Prisunivers V4.6.2: 239/239 current-roster-spillere har låst pris og er kjøpbare.
- 45 autoritative fantasy-runder og 225 kamper er kontrollert uten manglende runde-/kampkoblinger.
- MP-02.6 roster-/kampdatasynk og MP-09 availability følges løpende gjennom sesongen.

## Fantasy – implementert kjerne

- Persistente brukerlag, 100m budsjett, posisjons-/klubbregler, rekke 1/2, C/VC og responsive lagbyggerflater.
- MP-04.5/04.6 transferkjernen er ferdigstilt og behavioralt verifisert: maks 2 permanente bytter per ordinær runde, ingen bank eller poengtrekk, Bytteboost opptil 4, Event Week-sperre og permanent transferledger.
- MP-04.7 viser autoritative gameweek-motstandere med H/B og 0/1/flere kamper direkte i lagbyggeren.
- **MP-04.8 obligatorisk Fantasy-lagnavn er ferdigstilt og produksjonsverifisert 2026-08-24.** Nye lag kan ikke lagres med tomt/whitespace-navn eller placeholder; servervalidator, triggergate og authenticated-only rename-RPC er på plass. Navneendring teller ikke som transfer og endrer ikke team-ID, roster, C/VC, transferledger, snapshots, boostere eller poeng.
- MP-05 kalender/deadline/snapshot-kjernen er implementert.
- MP-06 scoring med special teams, C×2 og VC×1,5 er implementert; full live-validering mot representative 2026/27-kamper tas når slike kamper finnes.
- MP-07.1–07.9 leaderboard, tie-break, Bonus Weeks, snapshot-first rundehistorikk og personlig statistikk er ferdigstilt.
- **MP-07.10 lagnavn + eiernavn er ferdigstilt og produksjonsverifisert 2026-08-24.** Globalt leaderboard bruker dagens Fantasy-lagnavn + dagens bekreftede Stang Inn-profilnavn; historiske runder bruker snapshot-frosset `team_name` + `owner_name`; månedstabell bruker identiteten fra siste snapshot i måneden. Ingen e-post/private profilfelt eksponeres. Identity-RPC-ene er authenticated-only og Vercel er grønn.
- **MP-07.11 + MP-07.12 Event Weeks er ferdigstilt og produksjonsverifisert 2026-08-25.** GW15 = Rik Onkel 200m med separat eventlag, GW38 = Fattig Onkel 70m med separat eventlag, og GW22 = Julebord / «Alle skal med!» med begge rekker 100 %, ordinær C×2/VC×1,5 og personlige boostere sperret. Alle tre peker på autoritative femkampsrunder med 10 lag og deadline lik første kampstart. Permanente transfers er sperret i Event Weeks, permanentlaget overskrives ikke av Rik/Fattig-eventlag, og snapshot/scoring/history/leaderboard/UI-kjeden er koblet til eventidentiteten.
- Produksjonsdatabasen inneholder den faktiske Event Week-konfigurasjonen; verifikasjonen baserte seg ikke bare på SQL-filer i repoet. Ved sluttkontroll var target-rundene fortsatt uten snapshots/scoring/aktive boostere/permanente transferbatcher, så eksisterende 2026/27-historikk var ikke omskrevet.
- Event Week-RPC-er er authenticated-only der de skal være det, `anon` har ikke utilsiktet EXECUTE på de kontrollerte bruker-/interne funksjonene, og Event Week-regresjonen + øvrige CI-gater + Next.js-build er grønne på `main`.
- Bonus Weeks: Kapteinsboost ×2,5, Rekkeboost (rekke 2 = 100 %), Bytteboost opptil 4; Rik/Fattig Onkel bruker separate eventlag.
- MP-08 analyse/xFP/fixture-rating er produksjonsverifisert. Preseason-/treningskampstatistikk brukes ikke som Fantasy-signal.
- MP-10 lagoptimalisator er ferdigstilt som adminverktøy.
- **MP-11.8 redesign/branding er ferdigstilt.** Valgt premium sportsretning med Stang Inn-logo/SI-mark, samlet shell/header/navigasjon, svart/gull merkevare, metadata/favicon/app-assets og konsistent mobil/desktop-presentasjon er implementert på `main` og produksjonsverifisert.

## Tipping og felles miniligaer

- MP-13.1–13.5 er preseasonklare: kamptips, tabelltips, server-eid scoring, awards/statistikk og mobilflyt.
- **MP-13.6 felles miniligaer er ferdigstilt og produksjonsverifisert 2026-08-24.**
  - Én kanonisk `stang_inn_private_leagues` + `stang_inn_private_league_members`-modell brukes på tvers av Tipping og Fantasy.
  - Eksisterende legacy-ligaer og medlemskap er migrert uten tap av liga-ID, invitasjonskode, eier, medlemskap eller `joined_at`; legacy-tabellene beholdes som immutable migreringshistorikk.
  - Gamle Fantasy-/Tipping-RPC-er er kompatibilitetswrappere mot den felles modellen.
  - Create/join/list/leave og medlemskontroll er authenticated-only; `anon` har ikke EXECUTE, og vanlige klientroller har ingen direkte tabelltilgang.
  - Ligaeier er ligadmin og kan ikke forlate ligaen; ordinær utmelding fjerner medlemskapet fra begge produkter og rejoin via samme kode gjenoppretter begge.
  - `/leagues` er felles brukerflate med Tipping-/Fantasy-faner; gamle `/fantasy/leagues`-ruter redirecter dit.
  - Fantasy-tabellen bruker autoritativ Fantasy-ranking/tie-break og viser lagnavn + bekreftet profilnavn. Tipping-tabellen beholder eksisterende tipping-score/tie-break og viser Stang Inn-profilnavn.
  - Rollback-only behavioral produksjonstest verifiserte cross-product create/join/synlighet, separate standings, leave/rejoin, owner-sperre og 0 testrester.
  - MP-13.6-regresjon er koblet til CI og Vercel-build er grønn.
- Live-verifisering av Tipping fortsetter på reelle sesongdata.

## Testing og sikkerhet

- **MP-12 bred sluttregresjon er ferdigstilt og grønn etter identitets-, lagnavn-, miniliga-, Event Week- og MP-11.8-endringene.** GitHub Actions og Vercel er grønne.
- MP-01.6-produksjonsregresjonen beskytter cron-secret/retry, HockeyLive-timeout, partial-sync failure og service-only hardening.
- MP-04 transferregresjonen inkluderer MP-04.8-kontrakter.
- MP-07.10-regresjonen beskytter snapshot-frosset `owner_name`, bekreftet profilnavn, identitets-RPC-er, uendret ranking/tie-break, fravær av e-post og anon-hardening.
- MP-07.11/07.12-regresjonen beskytter GW15/GW22/GW38, 200m/70m, Julebord-rekke 2 = 100 %, ordinær C/VC, booster-/transfersperrer og Event Week-identitet i UI/historikk.
- MP-13.6-regresjonen beskytter den kanoniske felles liga-/medlemskapsmodellen, cross-product medlemskap, separate produktstandings, owner/leave/rejoin og auth/RLS.
- Produksjonssmoke og testisolasjonskontroller viste 0 varige syntetiske testrester i ekte 2026/27-data.

## Aktivt område / neste kobling

**MP-11.8, MP-12 sluttregresjon og MP-01.6 er nå ferdige.** Produksjonsgrunnlaget, sikkerhets-/driftsrunbooken og sluttregresjonen er dermed klare for den endelige launch-gaten.

**Neste operative hovedpunkt er Chat 14 – MP-14.1–14.7 endelig launch-gate.** Bruk `docs/MASTERPLAN.md`, `docs/PROJECT_STATUS.md` og `docs/MP01_PRODUCTION_RUNBOOK.md` og sett eksplisitt PASS/FAIL for regler, spillerpool/priser, alle 45 runder/deadlines, scoring/snapshots/leaderboard, miljø/secrets/cron, mobil/desktop og backup/rollback/adminrutiner.

Deretter:

1. Chat 14 – MP-14.8 GO LIVE når alle kritiske gates er PASS.
2. MP-06.6 tas i Chat 06 når representative 2026/27-seriekamper finnes; MP-02.6/MP-09/MP-13 live-verifisering fortsetter løpende gjennom sesongen.

## Arbeidsstart i ny chat

1. Les `docs/MASTERPLAN.md` og relevante addendum.
2. Les `docs/PROJECT_STATUS.md`.
3. Kontroller siste `main` og relevante filer/RPC-er.
4. Ikke anta at eldre chat-historikk er nyere enn GitHub.
5. Implementer/test/verifiser ett avgrenset steg om gangen.
6. Oppdater masterplan/status når et hovedsteg faktisk er ferdig.