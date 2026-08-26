# Stang Inn – PROJECT STATUS

Sist kontrollert mot GitHub `main`: 2026-08-26

## Source of truth

- Teknisk sannhet: GitHub `main`.
- Prosjektplan/prioritering: `docs/MASTERPLAN.md` + gjeldende masterplan-addendum.
- Denne filen er et kort teknisk kontrollpunkt for nye arbeidsøkter/chatter.
- Eldre roadmap-filer skal ikke overstyre masterplan, addendum eller faktisk kode.

## Launch-status

- **MP-14.1–MP-14.7: PASS.** Endelig launch-gate er fullført og dokumentert i `docs/MP14_LAUNCH_GATE.md`.
- **MP-14.8 GO LIVE: gjennomført 2026-08-26 etter eksplisitt produkteiergodkjenning.** Produksjonen er i sesongdrift.
- **MP-06.6 står fortsatt åpen** og skal først lukkes etter full live-produksjonsvalidering mot representative ekte 2026/27-seriekamper.

## Stack og drift

- Next.js 16.2.11 / React 19.2.0 / TypeScript 5.9.x.
- Supabase + Vercel.
- GitHub Actions build-CI med MP-01 produksjonsdrift, MP-01 brukeradmin-livssyklus, MP-12 scoring/security/test-isolation, MP-13 scoring/readiness/felles miniligaer, MP-04 transfer, Bonus Weeks, MP-07 rundehistorikk/stats/identitet/Event Weeks og MP-10 optimizer før build.
- Isolerte tester skal aldri endre ekte 2026/27-data og skal rydde egne syntetiske fixtures.
- **MP-01.6 produksjons-/driftsgaten er ferdigstilt og produksjonsverifisert.** Operativ runbook: `docs/MP01_PRODUCTION_RUNBOOK.md`.
- Supabase-organisasjonen `Hockeytips` er verifisert på **Pro**, slik at managed-backup-forutsetningen er etablert.
- HockeyLive-requester har intern timeout, og delvise sync-/Fantasy-livssyklusfeil gir `ok=false`/HTTP 500 slik at cron kan retry-e i stedet for å rapportere falsk suksess.

## Felles brukeridentitet og brukeradministrasjon

- **MP-01.7 er ferdigstilt og produksjonsverifisert 2026-08-24.** `public.players` er den generelle Stang Inn-profilen for Tipping, Fantasy, leaderboard og felles miniligaer.
- Ny/ufullstendig bruker må eksplisitt bekrefte profilnavn via `/onboarding`; Google-navn er kun forslag.
- **Felles brukeradministrasjon er produksjonsverifisert 2026-08-26.** `/admin/users` er eneste autoritative skriveflate for profiler/Auth/roller på tvers av Stang Inn. Admin kan se sikker brukeroversikt, endre profilnavn, administrere adminrolle, deaktivere/gjenåpne konto og se auditlogg. Permanent sletting fra adminflaten er deaktivert slik at konkurransehistorikk beholdes.
- `players.deactivated_at` + Supabase Auth-ban brukes sammen ved deaktivering. AuthGate kontrollerer deaktiveringsmarkøren fail-closed.
- `user_admin_audit` har RLS og er stengt for direkte klienttilgang. Siste aktive administrator og egen administratorkonto er beskyttet mot utilsiktet deaktivering/nedgradering.
- Produksjonsflyten **aktiv → deaktivert → gjenåpnet** er testet med reell adminbruker, og auditloggen viste handlingene med riktig utførende administrator.
- Den gamle brukeradministrasjonen i Hockeytipset-admin er fjernet som skriveflate og erstattet med lenke til `/admin/users`. Regresjonen `test:mp01:user-admin` beskytter at legacy brukerwrites ikke kommer tilbake.
- Operativ dokumentasjon: `docs/MP01_USER_ADMIN.md`.

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
- **MP-04.8 obligatorisk Fantasy-lagnavn er ferdigstilt og produksjonsverifisert 2026-08-24.** Nye lag kan ikke lagres med tomt/whitespace-navn eller placeholder; servervalidator, triggergate og authenticated-only rename-RPC er på plass. Navneendring teller ikke som transfer.
- **Fantasy spillerkort-konsistens er oppdatert 2026-08-26.** Spillermarkedet bruker nå samme grunnstruktur/informasjonsrekkefølge som spillerkortene under `Mitt lag`: posisjon, spiller, klubb/posisjon, valgt rundes motstander(e) med H/B og pris. Markedskortet beholder `+` som egen add-handling. Implementert på `main` i commit `f12120e9` og skal behandles som UI-kontrakt ved senere lagbyggerendringer.
- MP-05 kalender/deadline/snapshot-kjernen er implementert.
- MP-06 scoring med special teams, C×2 og VC×1,5 er implementert; full live-validering mot representative 2026/27-kamper tas når slike kamper finnes.
- MP-07 leaderboard, tie-break, Bonus Weeks, rundehistorikk, identitet og Event Weeks er ferdigstilt.
- MP-08 analyse/xFP/fixture-rating er produksjonsverifisert. Preseason-/treningskampstatistikk brukes ikke som Fantasy-signal.
- MP-10 lagoptimalisator er produksjonsverifisert som admin-only analyseverktøy.
- **MP-11.8 redesign/branding er ferdigstilt.** Valgt premium sportsretning med Stang Inn-logo/SI-mark, samlet shell/header/navigasjon, svart/gull merkevare og konsistent mobil/desktop-presentasjon er implementert.
- **MP-11 UI-kontrakt:** `Spillermarked` og `Mitt lag` skal bruke samme spillerkortspråk på mobil og desktop. Forskjellen skal primært være konteksthandlingene (f.eks. `+` i markedet versus C/VC/fjern/bytt-rekke på laget), ikke ulik grunnpresentasjon av spilleren.

## Tipping og felles miniligaer

- MP-13.1–13.5 er preseasonklare: kamptips, tabelltips, server-eid scoring, awards/statistikk og mobilflyt.
- **MP-13.6 felles miniligaer er ferdigstilt og produksjonsverifisert 2026-08-24.** Én kanonisk liga-/medlemskapsmodell brukes på tvers av Tipping og Fantasy, med authenticated-only RPC-er og separate produktstandings.
- Live-verifisering av Tipping fortsetter på reelle sesongdata.

## Testing og sikkerhet

- **MP-12 bred sluttregresjon er ferdigstilt og grønn.** GitHub Actions og Vercel er etablerte produksjonsgater.
- MP-01.6-produksjonsregresjonen beskytter cron-secret/retry, HockeyLive-timeout, partial-sync failure og service-only hardening.
- MP-01 user-admin-regresjonen beskytter admin-gate, deaktivering/gjenåpning, audit, last-admin/self-gater, fravær av hard delete og én autoritativ brukeradminflate.
- Relevante Fantasy/Tipping/leaderboard/miniliga/Event Week-regresjoner skal videreføres ved sesongendringer.
- Produksjonssmoke og testisolasjonskontroller skal fortsatt sikre 0 varige syntetiske testrester i ekte 2026/27-data.

## Aktivt område / neste kobling

**Stang Inn EHL 2026/27 er GO LIVE.** Prosjektet er overlevert fra pre-launch til sesongbasert drift.

Neste operative fokus:

1. **MP-02.6 / MP-09 / MP-13 – løpende sesongdrift:** roster, kampdatasynk, availability, tipping-liveverifisering, CI/Vercel/Supabase og cron/sync overvåkes fortløpende.
2. **MP-06.6 – full live kampdatavalidering:** tas i Chat 06 så snart representative ekte 2026/27-seriekamper finnes.
3. Ved driftsavvik brukes `docs/MP01_PRODUCTION_RUNBOOK.md` og `docs/MP14_LAUNCH_GATE.md` som operativt grunnlag.

## Arbeidsstart i ny chat

1. Les `docs/MASTERPLAN.md` og relevante addendum.
2. Les `docs/PROJECT_STATUS.md`.
3. Kontroller siste `main` og relevante filer/RPC-er.
4. Ikke anta at eldre chat-historikk er nyere enn GitHub.
5. Implementer/test/verifiser ett avgrenset steg om gangen.
6. Oppdater masterplan/status når et hovedsteg faktisk er ferdig.
