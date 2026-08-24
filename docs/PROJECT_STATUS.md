# Stang Inn – PROJECT STATUS

Sist kontrollert mot GitHub `main`: 2026-08-24

## Source of truth

- Teknisk sannhet: GitHub `main`.
- Prosjektplan/prioritering: `docs/MASTERPLAN.md` + gjeldende masterplan-addendum.
- Denne filen: kort teknisk kontrollpunkt for nye arbeidsøkter/chatter.
- Eldre roadmap-filer er historisk/tematisk dokumentasjon og skal ikke overstyre `MASTERPLAN.md`, gjeldende addendum eller faktisk kode på `main`.

## Stack

- Next.js 16.2.11
- React 19.2.0
- TypeScript 5.9.x
- Supabase
- Vercel
- GitHub Actions build-CI med MP-12 scoring/security/test-isolation, MP-13 scoring/readiness, MP-04 transfer, Bonus Weeks, MP-07 rundehistorikk/stats og MP-10 optimizer før full build.

## Felles brukeridentitet / MP-01.7

- **MP-01.7 er ferdigstilt og produksjonsverifisert 2026-08-24.** `public.players` er den generelle Stang Inn-profilen for Tipping, Fantasy, leaderboard og kommende felles miniligaer.
- Google-auth beholdes, men Google-navn er kun et forslag. Ny/ufullstendig bruker må eksplisitt bekrefte et Stang Inn-profilnavn i `/onboarding` før konkurranseflater åpnes.
- `profile_name_confirmed_at` er eksplisitt completion-state. Global `AuthGate` sjekker den før appinnhold rendres og sender ufullstendig profil til onboarding også ved direkte URL-navigering.
- `complete_stanginn_profile_v1(text)` er authenticated-only, normaliserer whitespace, krever 2–60 tegn og avviser kontrolltegn. Hotfix bruker eksplisitt `players_pkey` som conflict-target.
- Authenticated-klienter har ikke direkte INSERT/UPDATE/DELETE på `players`, og `players.email` er ikke lesbar for vanlige konkurranseklienter. `anon` har ikke EXECUTE på profil-RPC-en.
- Reell ny Google-bruker er testet end-to-end. Etter testen hadde produksjonen 3/3 bekreftede profiler, 0 ufullstendige og 0 ugyldige bekreftede navn.
- `test:mp01:onboarding` dekker completion-state, bypass-gate, eksplisitt lagring, Google-forslag, servervalidering og profilprivilegier. Separat CI-probe bestod 8/8 kontroller.

## EHL 2026/27

- Tournament ID: `448981`.
- Preseason-spillerpoolen er verifisert mot EliteProspects som autoritativ preseason-fasit.
- Produksjon har 239 aktive/current-roster-spillere fordelt på 10 kanoniske EHL-lag: Frisk Asker 23, Lillehammer 22, Narvik 24, Nidaros 23, Ringerike 24, Sparta 25, Stavanger 25, Stjernen 25, Storhamar 25 og Vålerenga 23.
- Full EliteProspects-audit: 239/239 matchet, 0 mangler, 0 tvetydige, 0 lagavvik, 0 ekstra og 0 posisjonsavvik.
- Klubbverdier er normalisert; 0 ikke-kanoniske current-roster-lagverdier og 0 duplikate external IDs.
- Fire EP-bekreftede spillere uten tilgjengelig NIF-ID bruker eksplisitt provisorisk `ep:`-identitet: Filip Bratt, Matteo Mitrovic, Alexander Bjurström og Ludwig Blomstrand. NIF-ID skal aldri oppdiktes; senere overgang til NIF-identitet skal skje eksplisitt og sikkert.
- HockeyLive tournamentId `448981` beholdes for kamp-/ID-data. `TournamentPlayers` var tom preseason, og `TournamentTeams -> TeamMembers` skal ikke behandles som autoritativ sesongroster.
- Kalenderbasert fantasy-rundestruktur og deadline/snapshot-system er implementert.
- MP-12 sluttkontroll 2026-08-24 bekreftet 45 autoritative fantasy-runder, 225 kamper, 0 runder uten kampkobling, 0 kamper uten fantasy-runde og 0 cross-season-lenker.

## Fantasy – implementert kjerne

- Spillerpool og pris-publisering.
- MP-03.6 sluttkalibrering er publisert som V4.6.2. Produksjon er kontrollert med 239/239 current-roster-spillere priset, 239/239 låste sesongpriser, 239/239 kjøpbare, nøyaktig 14 godkjente prisendringer, 0 avvik mellom spillerpris og sesongpris, 0 stale lagrede `purchase_price` og 0 eksisterende lag over 100m. Ingen fantasy-scoringregler ble endret.
- Persistente brukerlag, kaptein/visekaptein og klubb-/lagvalideringer.
- MP-04.7 gameweek-fixtures i «Mitt lag»: hver valgt spiller viser motstander(e) for den fantasy-runden laget bygges/redigeres for, med H/B-markering og eksplisitt «Ingen kamp». Visningen bruker autoritativ `get_fantasy_round_schedule_v1`.
- **MP-04.5/MP-04.6 transfer-/regelkjernen er ferdigstilt og behavioralt verifisert.** Maks 2 permanente spillerbytter per ordinær fantasy-runde, ingen byttebank og ingen poengtrekk. Bytteboost øker grensen til 4. Event Weeks sperrer permanente transfers. Transferledger lagrer batch/runde/lagverdi/INN/UT. Ny service-only synthetic E2E bruker `__e2e_*`; vanlige authenticated-brukere er fortsatt hardlåst til `2026/27`. Produksjons-E2E: 6/6 PASS.
- Kalenderbaserte runder, deadline-sikre snapshots og freeze/readiness-kontroller.
- Fantasy-poengmotor med special teams, kaptein ×2 og visekaptein ×1,5.
- **MP-07.6 Bonus Weeks er implementert og behavioralt produksjonsverifisert.** Kapteinsboost ×2,5, Rekkeboost rekke 2 = 100 %, Bytteboost opptil 4 transfers, Rik Onkel 200m separat eventlag og Fattig Onkel 70m separat eventlag. Bonus-/eventmetadata fryses i snapshotet. MP-12 E2E: 6/6 PASS. Testen fant en reell tvetydig `ON CONFLICT`-feil i Event Week-konfigurasjonen; den er rettet med eksplisitt unique-constraint-target og verifisert på nytt.
- **MP-07.7 rundehistorikk er snapshot-first.** `get_my_fantasy_round_history_v1` starter fra snapshots og snapshotspillere; dagens lag brukes aldri til historisk rekonstruksjon. UI viser rekke 1/2, C/VC, priser, lagverdi, boost/event, poeng/multiplikatorer og relevante transfers.
- **MP-07.8 personlig statistikkdashboard er ferdigstilt.** `/fantasy/stats` ligger under Poeng-seksjonen og viser poeng per runde, kumulative poeng, sammenlagtrank/rankutvikling, runderank, rankendring, lagverdi over tid, poeng per posisjon, C/VC-bidrag og transfers.
- **MP-07.9 sikre sesonginnsikter er ferdigstilt.** Beste/verste runde, snitt, median, rundeseire, topp 10 %/1 %, kapteinsandel, beste Bonus/Event Week, mest brukt/lengst beholdt spiller, beste C/VC-valg, klubbfordeling og sammenligning mot feltets snitt er implementert. Historisk transfergevinst, xFP-over/underprestasjon og availability-tapte poeng vises ikke uten sikkert datagrunnlag.
- Personlige stats-RPC-er er authenticated-only og `anon` har ikke EXECUTE.
- **MP-07.4 rundevisning er produksjonspolert.** Neste runde åpnes automatisk; kampvindu/deadline, kamper og lag med 0 eller flere kamper vises eksplisitt. Vercel-verifisert grønn.
- **MP-07.5 tie-break-regelverket er låst og migrert:** totalpoeng → flest rundeseire → høyeste enkelt-rundescore → delt plass ved fortsatt likhet. Teamnavn er kun stabil visningsrekkefølge. Samme sportslige kriterier brukes i movement/previous-rank. Regelen er publisert på Regler-siden.
- **MP-11.1–MP-11.5 samlet Fantasy UX-/mobilpass er ferdigstilt.** Fantasy-navigasjonen bruker riktig informasjonsarkitektur og mobilgrid; Fantasy markeres ikke lenger feil som Profil i global mobilnav. Mitt lag/Eventlag/Bytter har konsistent panelstil og større touch targets. Spillermarkedet, runder, Stats, Regler, Bonus Weeks og sentrale states er mobilpolert uten å endre forretningslogikk.
- **Spillere er nå en beslutningsflate.** `/fantasy/players` viser faktiske FP, FP/kamp, Form 5, eierandel, pris og kommende gameweek/motstander(e), med relevante sorteringer. Desktop bruker tabell-lignende rader; mobil viser kompakte kort uten nødvendig horisontal scrolling. Spillerprofilen er responsivt harmonisert med samme UI.
- Ny read-only RPC `get_fantasy_player_market_summary_v1` leverer bulk-FP til spillerlisten med samme latest-per-game-semantikk som eksisterende spillerprofil. Den er `authenticated`-only og `anon=false`; ingen scoringdata eller regler endres av RPC-en.
- Statistikksidens tidligere 820px brede runde-for-runde-tabell blir kort på mobil. Reglenes scoringtabeller blir tilsvarende mobilkort, mens desktop-tabellene beholdes.
- Bonus Weeks har eksplisitt loading/error/retry. Rundehistorikk forklarer at historikken blir tilgjengelig når første lag låses ved deadline. Spillere/spillerprofil har tydelige loading/error/empty states.
- Spillernavn i lagbygger/spillermarked og Eventlag åpner spillerprofil.
- MP-08 analyse-/xFP-kjernen er produksjonsverifisert; preseason-/treningskampstatistikk brukes ikke som Fantasy-signal.
- MP-09 availability-kjernen er produksjonsverifisert med konservativ matching/adminreview og kun godkjent availability inn i analyse/optimizer.
- **MP-10 lagoptimalisator er ferdigstilt som adminverktøy.** Ingen offentlig optimizer-side/API; availability-, transfer- og Event Week-reglene beholdes.

## Stang Inn tipping – preseasonklar

**MP-13.1–MP-13.5 er ferdigstilt på `main` for preseason, med live-verifisering som løpende sesongoppgave.**

- Kamptips bruker automatisk EHL-kampgrunnlag, kampvis deadline/lås, filtrering og tydelig mobilflyt. Server-side deadline feiler lukket.
- Tippingens `points` er server-eid. Authenticated klienter kan kun skrive spiller/kamp/resultattips, og negative tips stoppes i databasen.
- Automatisk tipping-scoring bruker autoritativ 5/3/0-motor, er idempotent og håndterer korrigert/gjenåpnet kamp. Egen scoring-regresjon er koblet i CI.
- Tabelltips bruker authenticated-only `save_table_tip_rankings`, krever 10 gyldige EHL-lag, håndhever deadline og skjuler andres tips frem til fristen. Faktisk EHL-tabell, avvik og konkurransestilling aktiveres når serien starter.
- Awards er implementert: Rundevinner, Månedsvinner, Eksperttittel, Sniper, Beste streak, Ukens bom og Sesongens bom. Awards bruker lagrede autoritative tippingpoeng.
- Spillerprofil viser sammenlagtplassering, poeng, treff, eksakte, streak, rundeseire, siste fem, poeng-/rankutvikling og synlig tipshistorikk.
- Offentlig tippingnavn skal nå bruke den bekreftede Stang Inn-profilidentiteten som grunnlag; senere konkurranseflater skal ikke eksponere e-post.
- Forside, Tabell, Kamptips, Tabelltips, Awards og Profil er mobil-/desktop-polert. Navigasjonsnavnet «Statistikk» er endret til «Tabell».
- `test:mp13:readiness` er read-only og dekker kamptips, deadline, server-eid scoring, tabelltips-RPC/innsyn, preseason→første kamp-overgang, awards og profilutvikling. Commit `9a19a91` er Vercel SUCCESS 2026-08-24.
- Første reelle ferdigspilte tippingrunde, første aktive tabelltips-avvik og første avsluttede kalendermåned skal verifiseres naturlig på reelle 2026/27-data. Ingen falske 2026/27-data skal opprettes for dette.

## MP-12 – pre-launch regresjon ferdigstilt

**MP-12.3 + MP-12.7 er ferdig og produksjonsverifisert 2026-08-24.** Behavioral sluttkontroller mot faktiske produksjonsfunksjoner ga:

- lagscoring / kaptein / visekaptein: 5/5 PASS
- snapshot/freeze: 4/4 PASS
- double gameweek / blank-week: 4/4 PASS
- round automation: 5/5 PASS
- egen rundedetalj og brukerisolasjon: 5/5 PASS
- leaderboard/tie-break/rundehistorikk: 5/5 PASS
- achievements/statistikk: 5/5 PASS
- Bonus/Event Weeks: 6/6 PASS
- transfers/Bytteboost/ledger: 6/6 PASS

Pre-launch-testingen fant og rettet to reelle produksjonsfeil før sesongstart: lagscoringen refererte til schema-relasjoner som ikke lenger fantes, og Event Week-konfigurasjonen hadde et tvetydig `ON CONFLICT`-target. Begge er nå regresjonsbeskyttet.

Sikkerhets-/isolasjonssluttkontroll:

- 0 Fantasy `SECURITY DEFINER`-funksjoner er kjørbare av `anon`.
- Prisrevisjonsfunksjonen `audit_fantasy_price_publication(uuid)` er nå `SECURITY INVOKER` og respekterer eksisterende admin-RLS.
- De usikre legacy transfer-/captain-E2E-helperne er fjernet.
- Nye behavioral E2E-RPC-er er service-only.
- Syntetisk transferkanal krever både `service_role` og `__e2e_*`; ordinary authenticated-brukere blir eksplisitt avvist og er fortsatt låst til `2026/27`.
- Sluttkontrollen viste 45 runder, 225 kamper, 239/239 kjøpbare spillere med 2026/27-pris og 0 rester i kontrollerte `__e2e_*` lag/runder/kamper/transferbatcher/boostere/priser/regler.

## Aktivt område / neste kobling

**MP-01.7 obligatorisk profilnavn/onboarding er ferdigstilt på `main` og produksjonsverifisert.** Identitetsgrunnlaget er dermed klart for Fantasy-lagnavn, eiernavn i tabeller og senere felles miniligaer.

**Neste operative hovedpunkt er Chat 04 – MP-04.8 obligatorisk Fantasy-lagnavn.** Nye Fantasy-lag skal ikke kunne lagres med tomt navn, `Mitt lag` eller tilsvarende placeholder, og eksisterende generiske lag skal få kontrollert kompletteringsflyt uten å miste spillere, snapshots, transfers eller historikk.

Deretter følger MP-07.10 lagnavn + eiernavn i Fantasy-tabeller og MP-13.6 felles miniligaer, i henhold til `MASTERPLAN_ADDENDUM_IDENTITY_MINILEAGUES.md`.

MP-02 preseason-rosterkontroll er produksjonsverifisert mot EliteProspects: 239/239 spillere, 0 mangler, 0 tvetydige, 0 lagavvik, 0 ekstra og 0 posisjonsavvik. Robust identitetsgate og løpende MP-02.6-drift beholdes.

MP-03.6 er ferdig og produksjonsverifisert som V4.6.2. Prisuniverset er komplett 239/239 og konsistent mellom spillerpool, låste sesongpriser og lagrede preseason-lag.

MP-09-kjernen er produksjonsverifisert. Kun admin-godkjent availability påvirker analyse/optimizer, og blokkerte statuser kan ikke foreslås. Første naturlige E2E via et reelt nytt review-funn tas når et slikt funn oppstår.

## Testing

- `test:mp01:onboarding` beskytter den globale profilcompletion-/bypass-kontrakten, eksplisitt profilbekreftelse, server-side navnevalidering og profilprivilegier. Separat CI-probe bestod 8/8 2026-08-24 uten å skrive 2026/27-data.
- GitHub Actions kjører MP-12 scoring/security/test-isolation, MP-13 scoring/readiness, MP-04 transfer, Bonus Weeks, MP-07 rundehistorikk/stats og MP-10 optimizer før full build på push/PR mot `main`.
- MP-13 readiness er read-only og skal aldri opprette eller endre 2026/27-data. Den beskytter kamptipsflyt, server-side deadline, server-eid poeng, tabelltips-kontrakt/innsyn, sesongstart-overgang, awards og spillerprofilens poeng-/rankutvikling.
- MP-04 transferregresjonen har både filbasert kontraktstest og service-only synthetic behavioral E2E. Behavioral testen skriver kun i `__e2e_mp12_transfers__`, kjører den faktiske `apply_fantasy_transfers_v1`, verifiserer 2/4-reglene, ledger og Bytteboost-commit, og rydder alle fixtures.
- MP-12 test-isolation-gaten beskytter at unsafe legacy-helperne forblir fjernet og at nye scoring/snapshot/DGW/automation/Bonus/Event/transfer-E2E-er bruker syntetisk namespace.
- Bonus Weeks-regresjonen beskytter eventlag-isolasjon, 200m/70m, booster inventory/deadline, snapshotmetadata, multiplikatorer, double-GW, Event Week-transfer-sperre og den eksplisitte Event Week conflict-constrainten.
- MP-07 rundehistorikkregresjonen beskytter snapshot-first-kontrakten, frosset spillernavn, score som `LEFT JOIN`, transferledger som kontekst, Event Week-isolasjon og authenticated-only RPC.
- MP-07 statsregresjonen beskytter dashboardet, spillerbaserte sesonginnsikter, feltbenchmarks og at historikk ikke rekonstrueres fra dagens lag. Usikre historiske estimater skal fortsatt holdes ute.
- MP-10 optimizerregresjonen beskytter admin-only-kontrakten og locked-player/0-2-4/Bytteboost/Event Week/availability/strategireglene.
- MP-07.7 produksjonskontroll bekreftet snapshot-first source, ingen `fantasy_user_team_players`, authenticated EXECUTE og ingen anon EXECUTE. Ingen falske 2026/27 snapshot-/lag-/poengdata ble opprettet.
- MP-07.9 spiller-/benchmark-RPC-er er eksplisitt hardened til `authenticated=true`, `anon=false`.
- MP-04.7 produksjonsdata viser 45 autoritative fantasy-runder; det finnes både runder med lag uten kamp og runder med dobbeltkamper.
- MP-11 spilleroppsummerings-RPC er verifisert med `authenticated_execute=true` og `anon_execute=false`. UX-passet skrev ikke testdata til ekte 2026/27-lag/runder.
- Produksjonsregelen står fast: isolerte tester skal ikke endre ekte 2026/27-data og skal rydde opp egne testdata.

## Kjente dokumentasjonsforhold

`README.md` beskriver fortsatt eldre prosjektstatus og er ikke oppdatert til dagens fantasyimplementasjon. Bruk `MASTERPLAN.md`, gjeldende addendum og denne filen som operativ oversikt inntil README er modernisert.

`docs/fantasy-roadmap.md` inneholder den opprinnelige fantasyretningen og er fortsatt nyttig for mål/prinsipper, men flere punkter er allerede implementert utover statusen som fremgår der.

## Arbeidsstart i ny ChatGPT-chat

Ved ny arbeidschat:

1. Les `docs/MASTERPLAN.md` og relevante addendum.
2. Les `docs/PROJECT_STATUS.md`.
3. Kontroller siste commits og relevante filer på `main` for MP-punktet som skal arbeides med.
4. Ikke anta at chat-historikk er nyere enn GitHub.
5. Implementer/test/verifiser ett avgrenset steg om gangen.
6. Oppdater masterplan/status når et hovedsteg faktisk er ferdig.