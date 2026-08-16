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

## Aktivt område

Siste commits på `main` 2026-08-16 gjelder spiller-tilgjengelighet/fravær. Dette er derfor aktivt utviklingsspor ved dette kontrollpunktet.

Neste naturlige tekniske kobling er:

`dokumentert availability -> roster matching -> xFP/analyse -> anbefalinger -> lagoptimalisator`

Arbeid på branch `mp09-availability-intake` / PR #14 legger til ikke-autoritativ kildefunn-kø, konservativ roster-matching og admin-review. Dette er ikke ferdig på `main` og skal ikke markeres som implementert før PR-en er verifisert og merged.

## Testing

- GitHub Actions kjører `npm run build` på push/PR mot `main`.
- Isolerte E2E-/testkontroller er implementert for sentrale fantasyflyter, blant annet snapshots og leaderboard.
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
