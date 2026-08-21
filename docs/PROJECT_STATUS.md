# Stang Inn – PROJECT STATUS

Sist kontrollert mot GitHub `main`: 2026-08-21

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
- GitHub Actions build-CI

## EHL 2026/27

- Tournament ID: `448981`.
- Preseason-spillerpoolen er verifisert mot EliteProspects som autoritativ preseason-fasit.
- Produksjon har 239 aktive/current-roster-spillere fordelt på 10 kanoniske EHL-lag: Frisk Asker 23, Lillehammer 22, Narvik 24, Nidaros 23, Ringerike 24, Sparta 25, Stavanger 25, Stjernen 25, Storhamar 25 og Vålerenga 23.
- Full EliteProspects-audit: 239/239 matchet, 0 mangler, 0 tvetydige, 0 lagavvik, 0 ekstra og 0 posisjonsavvik.
- Klubbverdier er normalisert; 0 ikke-kanoniske current-roster-lagverdier og 0 duplikate external IDs.
- Matteo Mitrovic, Johan Tørres Selnes og Mathias Dehli er verifisert aktive/current på Narvik.
- Fire EP-bekreftede spillere uten tilgjengelig NIF-ID bruker eksplisitt provisorisk `ep:`-identitet: Filip Bratt, Matteo Mitrovic, Alexander Bjurström og Ludwig Blomstrand. NIF-ID skal aldri oppdiktes; senere overgang til NIF-identitet skal skje eksplisitt og sikkert.
- HockeyLive tournamentId `448981` beholdes for kamp-/ID-data. `TournamentPlayers` var tom preseason, og `TournamentTeams -> TeamMembers` skal ikke behandles som autoritativ sesongroster.
- Kalenderbasert fantasy-rundestruktur og deadline/snapshot-system er implementert.

## Fantasy – implementert kjerne

- Spillerpool og pris-publisering.
- Prismodellfamilie gjennom v4.3, inkludert v4.1 markedskalibrering og import-/talentlogikk.
- Persistente brukerlag.
- Kaptein og visekaptein.
- Klubb-/lagvalideringer.
- Kalenderbaserte runder.
- Deadline-sikre snapshots og freeze/readiness-kontroller.
- Fantasy-poengmotor med special-teams-relatert scoring.
- Kaptein ×2 og visekaptein ×1,5.
- Sesong-leaderboard, rundering/rank og movement UI.
- Admin/analysegrunnlag og preseason xFP-preview.
- Sikker ekstern preseason parser med preview/approval.
- MP-08.4 kanonisk analyse-featurelag `get_fantasy_analysis_features_admin_v1`: sesong-FP/kamp, form 3/5/10, hjemme/borte, sample counts, pris og observert FP/kamp per million samles før modellberegning. Den raske xFP-horisonten bruker featurelaget direkte; anbefalingene arver samme datagrunnlag. Form 5 er fortsatt modellens form-input, og verken scoringregler eller xFP-vekter ble endret.
- Availability-datamodell, admin-API og admin-UI, inkludert «ikke i kamptropp».
- Ikke-autoritativ availability-funnkø med kilde, matchforslag, confidence, reviewstatus og audit.
- Konservativ roster-matching: usikre/tvetydige funn krever manuell admin-kontroll.
- Atomisk admin-godkjenning: gjeldende availability, historikk og funnstatus oppdateres i én PostgreSQL-transaksjon.
- Deterministisk kildeinnhenting fra allowlistede EHL-klubbsider og nitten.no med 45-dagers freshness-gate og deduplisering.
- HockeyLive MatchTeamMembers-kontroll for preseason og ordinære `fantasy_games`; ufullstendige kamptropper hoppes over, og fravær kan kun foreslå `not_in_lineup`.
- Lagoptimalisator med «beste komplette oppstilling» og «optimaliser med ledige bytter» på den raske `get_fantasy_xfp_round_horizons_admin_v2`-dataveien.
- Availability-policy i optimizer: `available` 100 %, `returning` 85 %, `questionable` 60 %, og `out`/`long_term`/`not_in_lineup` ekskluderes.
- MP-10.3 produksjonsverifisert: forventet poenggevinst, risikoscore, spiller-risiko, datatillit, availability-justert xFP og effektiv Fantasy-xFP med rekke/C/VC.
- MP-10.4 produksjonsverifisert 2026-08-21: Balansert, Konservativ og Offensiv bruker separate modellobjektiver og viser forventet gevinst, risiko, modellert oppside og UT → INN-forskjeller.

## Aktivt område / neste kobling

MP-02 preseason-rosterkontroll er produksjonsverifisert mot EliteProspects: 239/239 spillere, 0 mangler, 0 tvetydige, 0 lagavvik, 0 ekstra og 0 posisjonsavvik. Robust identitetsgate og løpende MP-02.6-drift beholdes.

MP-08.4 er produksjonsverifisert. Det kanoniske featurelaget returnerer 234 prisede/current spillere i produksjon, og både den raske xFP-horisonten og anbefalingsdatasettet returnerer samme 234 spillerunivers etter omkoblingen. Neste analysepunkt er MP-08.5: eksplisitt produksjons-/kalibreringskontroll av den dynamiske fixture-/motstanderratingen.

MP-09-kjernen er produksjonsverifisert. Kun admin-godkjent availability påvirker analyse/optimizer, og blokkerte statuser kan ikke foreslås. Varslingskjeden er teknisk produksjonsverifisert og første naturlige E2E via et reelt nytt review-funn tas når et slikt funn oppstår.

MP-10.3 og MP-10.4 er ferdige og produksjonsverifiserte på `main`. Resterende MP-10.1/10.2/10.5 ferdigstilles senere når pris-, fixture- og xFP-input er stabile nok. Gjeldende operative prioritering styres av `docs/MASTERPLAN.md`.

## Testing

- GitHub Actions kjører `npm run build` på push/PR mot `main`.
- Isolerte E2E-/testkontroller er implementert for sentrale fantasyflyter, blant annet snapshots og leaderboard.
- MP-08.4-produksjonssmoke: featurelag 234 rader, xFP-horisont 234 rader og anbefalingsdatasett 234 rader; API-endringen er Vercel-build/deploy-verifisert.
- Availability-endringene og optimizerstrategiene er build-/deploy-verifisert; produksjonsbruk følger fortsatt admin-review-gaten for availability.
- Produksjonsregelen står fast: isolerte tester skal ikke endre ekte 2026/27-data og skal rydde opp egne testdata.

## Kjente dokumentasjonsforhold

`README.md` beskriver fortsatt eldre prosjektstatus (bl.a. v0.3/v0.4-fase) og er ikke oppdatert til dagens fantasyimplementasjon. Bruk `MASTERPLAN.md` og denne filen som operativ oversikt inntil README er modernisert.

`docs/fantasy-roadmap.md` inneholder den opprinnelige fantasyretningen og er fortsatt nyttig for mål/prinsipper, men flere punkter er allerede implementert utover statusen som fremgår der.

## Arbeidsstart i ny ChatGPT-chat

Ved ny arbeidschat:

1. Les `docs/MASTERPLAN.md`.
2. Les `docs/PROJECT_STATUS.md`.
3. Kontroller siste commits og relevante filer på `main` for MP-punktet som skal arbeides med.
4. Ikke anta at chat-historikk er nyere enn GitHub.
5. Implementer/test/verifiser ett avgrenset steg om gangen.
6. Oppdater masterplan/status når et hovedsteg faktisk er ferdig.