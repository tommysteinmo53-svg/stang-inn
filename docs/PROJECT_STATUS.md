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
- GitHub Actions build-CI med MP-12 scoring/security/test-isolation, MP-13 scoring/readiness, MP-04 transfer, Bonus Weeks, MP-07 rundehistorikk/stats/identitet og MP-10 optimizer før build.
- Isolerte tester skal aldri endre ekte 2026/27-data og skal rydde egne syntetiske fixtures.

## Felles brukeridentitet

- **MP-01.7 er ferdigstilt og produksjonsverifisert 2026-08-24.** `public.players` er den generelle Stang Inn-profilen for Tipping, Fantasy, leaderboard og kommende felles miniligaer.
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
- **MP-04.8 obligatorisk Fantasy-lagnavn er ferdigstilt og produksjonsverifisert 2026-08-24.**
  - Nye lag kan ikke lagres med tomt/whitespace-navn eller placeholder som `Mitt lag`, `My team` eller `Lag`.
  - `normalize_fantasy_team_name_v1` normaliserer whitespace, krever 3–40 tegn, minst én bokstav eller ett tall og avviser kontrolltegn/placeholders.
  - `fantasy_user_teams_require_name_v1` håndhever samme kontrakt på `fantasy_user_teams` ved INSERT/UPDATE av navn, slik at eldre eller direkte skriveveier ikke omgår kravet.
  - `rename_fantasy_team_v1` er authenticated-only (`anon` har ikke EXECUTE) og oppdaterer kun eget lagnavn/`updated_at`.
  - Lagbyggeren starter ikke lenger med `Mitt lag`, inkluderer navnet i gyldighetskontrollen og har en egen rename-only kompletteringsflyt for eksisterende placeholder-lag.
  - Navneendring teller ikke som transfer og berører ikke team-ID, roster, C/VC, transferledger, snapshots, boostere eller poeng.
  - Eksisterende placeholder-lag ble bevisst ikke automatisk omskrevet; brukeren må selv velge nytt navn ved neste besøk.
- MP-05 kalender/deadline/snapshot-kjernen er implementert.
- MP-06 scoring med special teams, C×2 og VC×1,5 er implementert; full live-validering mot representative 2026/27-kamper tas når slike kamper finnes.
- MP-07.1–07.9 leaderboard, tie-break, Bonus Weeks, snapshot-first rundehistorikk og personlig statistikk er ferdigstilt.
- **MP-07.10 lagnavn + eiernavn er ferdigstilt og produksjonsverifisert 2026-08-24.**
  - Globalt leaderboard bruker `get_fantasy_competition_table_v2` og viser dagens Fantasy-lagnavn + dagens bekreftede Stang Inn-profilnavn som to tydelige identitetslinjer.
  - `fantasy_team_round_snapshots` har nytt `owner_name`; en insert-trigger fryser bekreftet `players.display_name` ved snapshot. Ingen e-post eller andre private profilfelt brukes.
  - Historisk policy er eksplisitt: rundevisning og lagets historikk bruker snapshot-frosset `team_name` + `owner_name`; månedstabell bruker identiteten fra lagets siste snapshot i måneden. Sesongtabellen bruker dagens navn.
  - Nye `get_fantasy_round_leaderboard_v2`, `get_fantasy_monthly_leaderboard_v2` og `get_fantasy_team_season_history_v3` gir identitetsbevisste read-modeller uten å endre poeng/ranking/tie-break.
  - Produksjonen hadde 0 snapshots for 2026/27 ved migrasjon og etter smoke-test, så ingen historiske data ble omskrevet.
  - Alle nye identity-RPC-er er eksplisitt authenticated-only; read-only kontroll bekreftet `anon_execute=false` for alle fire.
  - Eksisterende private Fantasy-miniliga ble kontrollert og viser allerede både `team_name` og `players.display_name`; den ble ikke endret, slik at eksisterende miniligarangering/tie-break forblir urørt før MP-13.6.
  - MP-07.10 filbasert regresjon er koblet inn i CI, og Vercel-build/deploy er grønn.
- Bonus Weeks: Kapteinsboost ×2,5, Rekkeboost (rekke 2 = 100 %), Bytteboost opptil 4; Rik/Fattig Onkel bruker separate eventlag.
- MP-08 analyse/xFP/fixture-rating er produksjonsverifisert. Preseason-/treningskampstatistikk brukes ikke som Fantasy-signal.
- MP-10 lagoptimalisator er ferdigstilt som adminverktøy.
- MP-11.1–11.7 samlet UX-/mobilpass er ferdigstilt; MP-11.8 branding/logo gjenstår.

## Tipping

- MP-13.1–13.5 er preseasonklare: kamptips, tabelltips, server-eid scoring, awards/statistikk og mobilflyt.
- Live-verifisering fortsetter på reelle sesongdata.
- MP-13.6 felles miniliga-medlemskap på tvers av Fantasy/Tipping gjenstår.

## Testing og sikkerhet

- MP-12 pre-launch-regresjon er gjennomført, men skal kjøres på nytt etter de nye identitets-/miniliga-/Event Week-endringene før launch-gate.
- MP-04 transferregresjonen inkluderer MP-04.8-kontrakter for servervalidator, placeholder-sperre, authenticated rename, safe completion og at lagnavnsendring ikke er en transfer.
- MP-07.10-regresjonen beskytter snapshot-frosset `owner_name`, bekreftet profilnavn, identitets-RPC-ene, uendret season/round rank-uttrykk, fravær av e-post, eksplisitt anon-hardening og mobil/desktop-presentasjonen.
- Produksjonssmoke for MP-07.10 var read-only: de nye RPC-ene finnes, global tabell returnerer både lagnavn og eiernavn, `authenticated` har EXECUTE og `anon` har ikke EXECUTE. Snapshot count for 2026/27 er fortsatt 0.
- RLS/auth er ikke svekket for MP-07.10.

## Aktivt område / neste kobling

**MP-01.7, MP-04.8 og MP-07.10 er ferdige.** Stabil brukeridentitet, stabil Fantasy-lagidentitet og konsekvent konkurransevisning er dermed på plass.

**Neste operative hovedpunkt er Chat 13 – MP-13.6: felles miniligaer på tvers av Tipping og Fantasy.** Identitetsgrunnlaget kan nå gjenbrukes i ett felles medlemskap, mens produktpoeng/rangeringer skal forbli separate.

Deretter følger, i henhold til siste `docs/MASTERPLAN.md`:

1. Chat 07 – MP-07.11 + MP-07.12 Event Weeks (GW15 Rik Onkel, GW22 Julebord, GW38 Fattig Onkel).
2. Chat 11 – MP-11.8 logo/branding.
3. Chat 12 – ny bred sluttregresjon.
4. Chat 01 + Chat 14 – produksjons-/launch-gate.
5. Chat 14 – GO LIVE når alle kritiske gates er PASS.

## Arbeidsstart i ny chat

1. Les `docs/MASTERPLAN.md` og relevante addendum.
2. Les `docs/PROJECT_STATUS.md`.
3. Kontroller siste `main` og relevante filer/RPC-er.
4. Ikke anta at eldre chat-historikk er nyere enn GitHub.
5. Implementer/test/verifiser ett avgrenset steg om gangen.
6. Oppdater masterplan/status når et hovedsteg faktisk er ferdig.
