# Stang Inn – PROJECT STATUS

Sist kontrollert mot GitHub `main`: 2026-08-24

## Source of truth

- Teknisk sannhet: GitHub `main`.
- Prosjektplan/prioritering: `docs/MASTERPLAN.md` + gjeldende masterplan-addendum.
- Denne filen er et kort teknisk kontrollpunkt for nye arbeidsøkter/chatter.
- Eldre roadmap-filer skal ikke overstyre masterplan, addendum eller faktisk kode.

## Stack og drift

- Next.js 16.2.11 / React 19.2.0 / TypeScript 5.9.x.
- Supabase + Vercel.
- GitHub Actions build-CI med MP-12 scoring/security/test-isolation, MP-13 scoring/readiness/felles miniligaer, MP-04 transfer, Bonus Weeks, MP-07 rundehistorikk/stats/identitet og MP-10 optimizer før build.
- Isolerte tester skal aldri endre ekte 2026/27-data og skal rydde egne syntetiske fixtures.

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
- Bonus Weeks: Kapteinsboost ×2,5, Rekkeboost (rekke 2 = 100 %), Bytteboost opptil 4; Rik/Fattig Onkel bruker separate eventlag.
- MP-08 analyse/xFP/fixture-rating er produksjonsverifisert. Preseason-/treningskampstatistikk brukes ikke som Fantasy-signal.
- MP-10 lagoptimalisator er ferdigstilt som adminverktøy.
- MP-11.1–11.7 samlet UX-/mobilpass er ferdigstilt; MP-11.8 branding/logo gjenstår.

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

- MP-12 pre-launch-regresjon er gjennomført, men skal kjøres på nytt etter de nye identitets-/miniliga-/Event Week-/brandingendringene før launch-gate.
- MP-04 transferregresjonen inkluderer MP-04.8-kontrakter.
- MP-07.10-regresjonen beskytter snapshot-frosset `owner_name`, bekreftet profilnavn, identitets-RPC-er, uendret ranking/tie-break, fravær av e-post og anon-hardening.
- MP-13.6-regresjonen beskytter den kanoniske felles liga-/medlemskapsmodellen, cross-product medlemskap, separate produktstandings, owner/leave/rejoin og auth/RLS.
- Produksjonssmoke for identitets- og miniligaflytene er bestått uten varige syntetiske produksjonsdata.

## Aktivt område / neste kobling

**MP-01.7, MP-04.8, MP-07.10 og MP-13.6 er ferdige.** Identitet og felles miniliga-medlemskap er dermed på plass.

**Neste operative hovedpunkt er Chat 07 – MP-07.11 + MP-07.12: produksjonskonfigurer Event Weeks.** GW15 Rik Onkel (200m), GW22 Julebord / «Alle skal med!» og GW38 Fattig Onkel (70m) skal sluttverifiseres mot autoritative runder, deadlines, transfers, boostere, snapshots, scoring, leaderboard/historikk og UI.

Deretter følger, i henhold til siste `docs/MASTERPLAN.md`:

1. Chat 11 – MP-11.8 logo/branding og valgt redesignretning.
2. Chat 12 – ny bred sluttregresjon.
3. Chat 01 + Chat 14 – produksjons-/launch-gate.
4. Chat 14 – GO LIVE når alle kritiske gates er PASS.

## Arbeidsstart i ny chat

1. Les `docs/MASTERPLAN.md` og relevante addendum.
2. Les `docs/PROJECT_STATUS.md`.
3. Kontroller siste `main` og relevante filer/RPC-er.
4. Ikke anta at eldre chat-historikk er nyere enn GitHub.
5. Implementer/test/verifiser ett avgrenset steg om gangen.
6. Oppdater masterplan/status når et hovedsteg faktisk er ferdig.
