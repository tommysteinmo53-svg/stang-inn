# Stang Inn – PROJECT STATUS

Sist kontrollert mot GitHub `main`: 2026-08-23

## Source of truth

- Teknisk sannhet: GitHub `main`.
- Prosjektplan/prioritering: `docs/MASTERPLAN.md`.
- Denne filen: kort teknisk kontrollpunkt for nye arbeidsøkter/chatter.
- Eldre roadmap-filer er historisk/tematisk dokumentasjon og skal ikke overstyre `MASTERPLAN.md` eller faktisk kode på `main`.

## Stack

- Next.js 16.2.11
- React 19.2.0
- TypeScript 5.9.x
- Supabase
- Vercel
- GitHub Actions build-CI + Bonus Weeks-, MP-04 transfer-, MP-07 rundehistorikk/stats- og MP-10 optimizerkontrakt/regresjon

## EHL 2026/27

- Tournament ID: `448981`.
- Preseason-spillerpoolen er verifisert mot EliteProspects som autoritativ preseason-fasit.
- Produksjon har 239 aktive/current-roster-spillere fordelt på 10 kanoniske EHL-lag: Frisk Asker 23, Lillehammer 22, Narvik 24, Nidaros 23, Ringerike 24, Sparta 25, Stavanger 25, Stjernen 25, Storhamar 25 og Vålerenga 23.
- Full EliteProspects-audit: 239/239 matchet, 0 mangler, 0 tvetydige, 0 lagavvik, 0 ekstra og 0 posisjonsavvik.
- Klubbverdier er normalisert; 0 ikke-kanoniske current-roster-lagverdier og 0 duplikate external IDs.
- Fire EP-bekreftede spillere uten tilgjengelig NIF-ID bruker eksplisitt provisorisk `ep:`-identitet: Filip Bratt, Matteo Mitrovic, Alexander Bjurström og Ludwig Blomstrand. NIF-ID skal aldri oppdiktes; senere overgang til NIF-identitet skal skje eksplisitt og sikkert.
- HockeyLive tournamentId `448981` beholdes for kamp-/ID-data. `TournamentPlayers` var tom preseason, og `TournamentTeams -> TeamMembers` skal ikke behandles som autoritativ sesongroster.
- Kalenderbasert fantasy-rundestruktur og deadline/snapshot-system er implementert.

## Fantasy – implementert kjerne

- Spillerpool og pris-publisering.
- MP-03.6 sluttkalibrering er publisert som V4.6.2. Produksjon er kontrollert med 239/239 current-roster-spillere priset, 239/239 låste sesongpriser, 239/239 kjøpbare, nøyaktig 14 godkjente prisendringer, 0 avvik mellom spillerpris og sesongpris, 0 stale lagrede `purchase_price` og 0 eksisterende lag over 100m. Ingen fantasy-scoringregler ble endret.
- Persistente brukerlag, kaptein/visekaptein og klubb-/lagvalideringer.
- MP-04.7 gameweek-fixtures i «Mitt lag»: hver valgt spiller viser motstander(e) for den fantasy-runden laget bygges/redigeres for, med H/B-markering og eksplisitt «Ingen kamp». Visningen bruker autoritativ `get_fantasy_round_schedule_v1`.
- **MP-04.5/MP-04.6 transfer-/regelkjernen er ferdigstilt.** Maks 2 permanente spillerbytter per ordinær fantasy-runde, ingen byttebank og ingen poengtrekk. Bytteboost øker grensen til 4. Event Weeks sperrer permanente transfers. Transferledger lagrer batch/runde/lagverdi/INN/UT, og `/fantasy/transfers` viser reglene og historikken.
- Kalenderbaserte runder, deadline-sikre snapshots og freeze/readiness-kontroller.
- Fantasy-poengmotor med special teams, kaptein ×2 og visekaptein ×1,5.
- **MP-07.6 Bonus Weeks er implementert og produksjonsverifisert.** Kapteinsboost ×2,5, Rekkeboost rekke 2 = 100 %, Bytteboost opptil 4 transfers, Rik Onkel 200m separat eventlag og Fattig Onkel 70m separat eventlag. Bonus-/eventmetadata fryses i snapshotet.
- **MP-07.7 rundehistorikk er snapshot-first.** `get_my_fantasy_round_history_v1` starter fra snapshots og snapshotspillere; dagens lag brukes aldri til historisk rekonstruksjon. UI viser rekke 1/2, C/VC, priser, lagverdi, boost/event, poeng/multiplikatorer og relevante transfers.
- **MP-07.8 personlig statistikkdashboard er ferdigstilt.** `/fantasy/stats` ligger under Poeng-seksjonen og viser poeng per runde, kumulative poeng, sammenlagtrank/rankutvikling, runderank, rankendring, lagverdi over tid, poeng per posisjon, C/VC-bidrag og transfers.
- **MP-07.9 sikre sesonginnsikter er ferdigstilt.** Beste/verste runde, snitt, median, rundeseire, topp 10 %/1 %, kapteinsandel, beste Bonus/Event Week, mest brukt/lengst beholdt spiller, beste C/VC-valg, klubbfordeling og sammenligning mot feltets snitt er implementert. Historisk transfergevinst, xFP-over/underprestasjon og availability-tapte poeng vises ikke uten sikkert datagrunnlag.
- Personlige stats-RPC-er er authenticated-only og `anon` har ikke EXECUTE.
- **MP-07.4 rundevisning er produksjonspolert.** Neste runde åpnes automatisk; kampvindu/deadline, kamper og lag med 0 eller flere kamper vises eksplisitt. Vercel-verifisert grønn.
- **MP-07.5 tie-break-regelverket er låst og migrert:** totalpoeng → flest rundeseire → høyeste enkelt-rundescore → delt plass ved fortsatt likhet. Teamnavn er kun stabil visningsrekkefølge. Samme sportslige kriterier brukes i movement/previous-rank. Regelen er publisert på Regler-siden.
- Fantasy-navigasjonen er ryddet: Mitt lag/Eventlag/Bytter er samlet som én seksjon, Poeng/Rundehistorikk/Min statistikk er samlet som én seksjon, og Achievements vises over Leaderboard i stedet for som eget hovedmenypunkt.
- Spillernavn i lagbygger/spillermarked og Eventlag åpner spillerprofil.
- MP-08 analyse-/xFP-kjernen er produksjonsverifisert; preseason-/treningskampstatistikk brukes ikke som Fantasy-signal.
- MP-09 availability-kjernen er produksjonsverifisert med konservativ matching/adminreview og kun godkjent availability inn i analyse/optimizer.
- **MP-10 lagoptimalisator er ferdigstilt som adminverktøy.** Ingen offentlig optimizer-side/API; availability-, transfer- og Event Week-reglene beholdes.

## Aktivt område / neste kobling

**MP-07.4–MP-07.9 er nå ferdigstilt og produksjonsverifisert på `main`.** Konkurransepresentasjon, tie-break, snapshot-first rundehistorikk, personlig statistikk og sikre sesonginnsikter er på plass. Siste runde-/tie-break-frontendcommit er Vercel `SUCCESS`.

**Neste operative hovedpunkt er Chat 11 – MP-11.3–MP-11.5.** Nå som funksjonaliteten og informasjonsarkitekturen er stabil, skal hele Fantasy-brukerreisen gjennomgås samlet på mobil og desktop: lagbygger, spillerkort, runder, leaderboard, Poeng/Stats, Eventlag/Bytter, navigasjon, readability og loading/error/empty states.

MP-02 preseason-rosterkontroll er produksjonsverifisert mot EliteProspects: 239/239 spillere, 0 mangler, 0 tvetydige, 0 lagavvik, 0 ekstra og 0 posisjonsavvik. Robust identitetsgate og løpende MP-02.6-drift beholdes.

MP-03.6 er ferdig og produksjonsverifisert som V4.6.2. Prisuniverset er komplett 239/239 og konsistent mellom spillerpool, låste sesongpriser og lagrede preseason-lag.

MP-09-kjernen er produksjonsverifisert. Kun admin-godkjent availability påvirker analyse/optimizer, og blokkerte statuser kan ikke foreslås. Første naturlige E2E via et reelt nytt review-funn tas når et slikt funn oppstår.

## Testing

- GitHub Actions kjører transfer-, Bonus Weeks-, MP-07 rundehistorikk/stats- og optimizerregresjoner før build på push/PR mot `main`.
- MP-04 transferregresjonen er deterministisk og filbasert og skriver aldri til Supabase.
- Bonus Weeks-regresjonen beskytter eventlag-isolasjon, 200m/70m, booster inventory/deadline, snapshotmetadata, multiplikatorer, double-GW og Event Week-transfer-sperre.
- MP-07 rundehistorikkregresjonen beskytter snapshot-first-kontrakten, frosset spillernavn, score som `LEFT JOIN`, transferledger som kontekst, Event Week-isolasjon og authenticated-only RPC.
- MP-07 statsregresjonen beskytter dashboardet, spillerbaserte sesonginnsikter, feltbenchmarks og at historikk ikke rekonstrueres fra dagens lag. Usikre historiske estimater skal fortsatt holdes ute.
- MP-10 optimizerregresjonen beskytter admin-only-kontrakten og locked-player/0-2-4/Bytteboost/Event Week/availability/strategireglene.
- MP-07.7 produksjonskontroll bekreftet snapshot-first source, ingen `fantasy_user_team_players`, authenticated EXECUTE og ingen anon EXECUTE. Ingen falske 2026/27 snapshot-/lag-/poengdata ble opprettet.
- MP-07.9 spiller-/benchmark-RPC-er er eksplisitt hardened til `authenticated=true`, `anon=false`.
- MP-04.7 produksjonsdata viser 45 autoritative fantasy-runder; det finnes både runder med lag uten kamp og runder med dobbeltkamper.
- MP-07.4/07.5 siste frontend/deploy er Vercel `SUCCESS`; tie-break-funksjonen er migrert til produksjon.
- Produksjonsregelen står fast: isolerte tester skal ikke endre ekte 2026/27-data og skal rydde opp egne testdata.

## Kjente dokumentasjonsforhold

`README.md` beskriver fortsatt eldre prosjektstatus og er ikke oppdatert til dagens fantasyimplementasjon. Bruk `MASTERPLAN.md` og denne filen som operativ oversikt inntil README er modernisert.

`docs/fantasy-roadmap.md` inneholder den opprinnelige fantasyretningen og er fortsatt nyttig for mål/prinsipper, men flere punkter er allerede implementert utover statusen som fremgår der.

## Arbeidsstart i ny ChatGPT-chat

Ved ny arbeidschat:

1. Les `docs/MASTERPLAN.md`.
2. Les `docs/PROJECT_STATUS.md`.
3. Kontroller siste commits og relevante filer på `main` for MP-punktet som skal arbeides med.
4. Ikke anta at chat-historikk er nyere enn GitHub.
5. Implementer/test/verifiser ett avgrenset steg om gangen.
6. Oppdater masterplan/status når et hovedsteg faktisk er ferdig.