# Stang Inn – PROJECT STATUS

Sist kontrollert mot GitHub `main`: 2026-08-16

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
- 2026/27-roster er etablert.
- Siste dokumenterte roster-preflight: 244 spillere, 244 match, 0 mangler, 0 tvetydige, 0 usikre nye, 0 lagavvik.
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
- Availability-datamodell, admin-API og admin-UI, inkludert «ikke i kamptropp».
- Ikke-autoritativ availability-funnkø med kilde, matchforslag, confidence, reviewstatus og audit.
- Konservativ roster-matching: usikre/tvetydige funn krever manuell admin-kontroll.
- Atomisk admin-godkjenning: gjeldende availability, historikk og funnstatus oppdateres i én PostgreSQL-transaksjon.
- Deterministisk kildeinnhenting fra allowlistede EHL-klubbsider og nitten.no med 45-dagers freshness-gate og deduplisering.
- HockeyLive MatchTeamMembers-kontroll for preseason og ordinære `fantasy_games`; ufullstendige kamptropper hoppes over, og fravær kan kun foreslå `not_in_lineup`.

## Aktivt område / neste kobling

MP-09.4 og MP-09.5 er implementert på `main` gjennom følgende verifiserte hovedcommits:

- `00862b9` – sikker availability-funnkø, matching, review og atomisk godkjenning.
- `c61ed04` – dokumentert/deterministisk kildeinnhenting fra nitten.no og klubbkilder.
- `1d62a6f` – HockeyLive kamptroppsfunn for preseason.
- `0b70779` – HockeyLive-kontroll utvidet til ordinær EHL 2026/27-sesong.

GitHub Actions Build og Vercel var grønne på de respektive PR-headene før merge. Availability-funn blir fortsatt aldri autoritative automatisk.

Neste effektive avhengighet er å ferdigstille analysegrunnlaget i MP-08 (preseason/form/fixture). Deretter kobles kun **admin-godkjent** `fantasy_player_availability` inn i xFP/anbefalinger under MP-09.6. Usikre eller ikke-godkjente kildefunn skal ikke påvirke modellen.

## Testing

- GitHub Actions kjører `npm run build` på push/PR mot `main`.
- Isolerte E2E-/testkontroller er implementert for sentrale fantasyflyter, blant annet snapshots og leaderboard.
- Availability-endringene er build-/deploy-verifisert, men produksjonsbruk skal fortsatt følge admin-review-gaten.
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
