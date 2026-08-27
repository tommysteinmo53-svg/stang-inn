# MP-01 scaling readiness – 2026-08-27

> Operativt addendum til `docs/MASTERPLAN.md`, `docs/PROJECT_STATUS.md` og `docs/MP01_PRODUCTION_RUNBOOK.md`.
> GitHub `main` og Supabase-produksjonsprosjekt `ottyuonvnjblvficmymt` er fasit.

## Konklusjon

**PASS – produksjonsklar cachearkitektur for konkurranseflater.**

Loadtesten avdekket at dynamisk sesongaggregering per request ikke var egnet for høy samtidighet på Supabase Micro. Konkurranseflatene er derfor flyttet til preberegnede scoring-/sesongmetrikker med live filtrering/rangering mot brukerstatus og profilidentitet.

Produksjonsverifisering 2026-08-27:

- GitHub `main`: cache-refresh koblet til autoritativ HockeyLive/EHL-sync.
- Produksjons-Supabase: `ottyuonvnjblvficmymt`.
- Cachetabeller har RLS aktivert og ingen direkte SELECT for `anon` eller `authenticated`.
- Refresh-RPC-er er kun tilgjengelige for `service_role`.
- Read-RPC-er er kun tilgjengelige for `authenticated`.
- Deaktiverte brukere filtreres live og krever ikke cache-refresh for å forsvinne fra konkurranseflatene.
- Produksjonscache etter initial seed: 9 Tipping-profiler / 7 aktive, 2 Fantasy-lag / 2 aktive.
- Første fulle auto-sync etter Data API-hotfix, 2026-08-27 13:10 UTC: `ok=true`, 225 kamper lest, ingen `error_message`.
- GitHub Actions og Vercel er grønne på safe-delete-hotfixen.

## Loadtest

Isolert Supabase preview branch `mp01-loadtest` ble brukt med syntetiske data, aldri produksjonsdata:

- 1 000 syntetiske brukere
- 225 kamper
- 225 000 tips
- 1 000 Fantasy-lag
- 45 000 Fantasy-rundepoeng

### Før cache

Den opprinnelige Tipping-leaderboardberegningen tok om lag 71,3 sekunder på testdatasettet. En første SQL-optimalisering reduserte dette til rundt 0,61 sekunder, men dynamisk full sesongberegning per request feilet fortsatt under samtidige requests.

### Etter cache

Cache-refresh på Micro-preview:

- Tipping, 225 000 tips: ca. 0,69 s
- Fantasy, 45 000 rundepoeng: ca. 0,40 s

Cached read-paths:

- Tipping «min plass»: 100/250/500/1 000 samtidige requests, 0 feil
- Fantasy «min plass»: 100/250/500/1 000 samtidige requests, 0 feil
- Full Tipping-tabell (~990 rader): 1 000 samtidige requests, 0 feil; p95 rundt 10,7 s ved dette ekstreme burstet
- Full Fantasy-tabell (~990 rader): 100/250/500 samtidige requests, 0 feil. Ved 1 000 samtidige komplette tabellresponser traff en del requests klientens 20-sekundersgrense; dette tilsvarer nær én million leaderboard-rader samtidig og ble vurdert som responsvolum/nettverk snarere enn sesongaggregering.

Dette er en kapasitetstest, ikke et løfte om et eksakt antall samtidige sluttbrukere. Reell kapasitet påvirkes også av Vercel, nettverk, øvrige API-ruter og brukeradferd.

## Arkitektur

Autoritativ kamp-/scoring-/snapshotdata endres ikke av cachelaget.

`/api/sync-ehl` kjører den eksisterende autoritative flyten og refresher deretter:

- `refresh_tipping_leaderboard_cache_v1()`
- `refresh_fantasy_season_leaderboard_cache_v1('2026/27')`

En cache-refresh-feil gjør sync-resultatet `ok=false` og registreres i `sync_runs`; feil skjules ikke som grønn sync.

Read-RPC-er bruker cachede metrikker, men leser aktiv/deaktivert status og profil-/lagnavn live. Dette hindrer stale brukeridentitet og gjør at admin-deaktivering får umiddelbar effekt i tabellene.

## Produksjonsincident under innføring

Under innføringen ble den første manuelle cache-SQL-en kjørt i preview-branchen i stedet for produksjonsprosjektet. Dette ble oppdaget fordi syntetiske 1 000/990-tall ikke samsvarte med produksjon og fordi produksjons-API-loggene viste manglende cache-RPC.

Tiltak:

1. Produksjonsprosjektet ble identifisert eksplisitt som `ottyuonvnjblvficmymt` før videre writes.
2. Cachelaget ble installert der som en registrert Supabase migration.
3. Produksjons-RLS, grants, cachetall og RPC-er ble kontrollert direkte.
4. Første Data API-run avdekket `DELETE requires a WHERE clause` i full cache-clear.
5. Refresh-funksjonen ble hotfixet til eksplisitt `DELETE ... WHERE true`, uten endring av autoritative data.
6. Neste automatiske sync gikk grønt (`ok=true`).

### Fast driftsregel

Før manuell SQL/migration skal project-ref alltid kontrolleres eksplisitt. Preview-resultater skal aldri brukes som produksjonsbevis. Produksjonsverifisering skal bruke `ottyuonvnjblvficmymt`, med mindre produksjonsarkitekturen senere endres og dette dokumenteres eksplisitt.

## Sporbarhet

Relevante filer på `main`:

- `supabase/mp01-scaling-competition-cache-v1.sql`
- `supabase/mp01-scaling-competition-cache-safe-delete-v1.sql`
- `app/api/refresh-competition-cache/route.ts`
- `app/api/sync-ehl/route.ts`
- `lib/sync-service.ts`
- `.github/workflows/ehl-sync.yml`

Relevante commits:

- `4a9222c8135dd97c79f88b9884621c61769d4288` – refresh konkurranse-cache etter autoritativ sync
- `f9205eaf90fd34485d23e7940aadaa67ccc961db` – Data API-safe cache clear

## MP-01.6 gate

| Kontroll | Status |
| --- | --- |
| Produksjonsprosjekt identifisert | PASS |
| RLS / direkte cachetilgang | PASS |
| RPC-grenser `anon` / `authenticated` / `service_role` | PASS |
| Produksjonsmigration registrert | PASS |
| Cache seed og read-RPC-er | PASS |
| Automatisk cache-refresh etter EHL-sync | PASS |
| Cache-feil fail-closed i sync | PASS |
| Isolert syntetisk loadtest | PASS |
| CI | PASS |
| Vercel | PASS |
| Første post-hotfix produksjonssync | PASS |

**MP-01 scaling readiness: PASS.** Videre oppfølging er ordinær sesongdrift og observability, ikke en åpen launch-blokkering.
