# MP-01 production runbook – Stang Inn 2026/27

> Operativ driftsrutine for `stang-inn-xi.vercel.app`. GitHub `main` er teknisk source of truth. Hemmeligheter skal aldri legges i repoet.

Sist verifisert: 2026-08-25

## Produksjonsarkitektur

- App/deploy: Vercel, produksjonsalias `https://stang-inn-xi.vercel.app`.
- Database/Auth/Data API: Supabase prosjekt `ottyuonvnjblvficmymt`, region `eu-central-1`.
- EHL/HockeyLive: tournamentId `448981`, sesong `2026/27`.
- Automatisk synk: GitHub Actions `.github/workflows/ehl-sync.yml`, hvert 5. minutt.
- Synk-endepunkt: `/api/sync-ehl`, beskyttet med `CRON_SECRET`.
- Operativ synkhistorikk: `public.sync_runs`.

## Nødvendige miljøvariabler/secrets

Verdier skal kun ligge i de respektive secret-/environment-lagrene.

- Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `HOCKEYLIVE_TOURNAMENT_ID`, `NIF_SEASON_LABEL`, `CRON_SECRET`.
- GitHub Actions: `CRON_SECRET`, identisk med Vercel-verdien.

Ved mistanke om lekkasje: roter den berørte hemmeligheten, oppdater alle avhengige miljøer, deploy på nytt og verifiser auth/synk. Service-/secret keys skal aldri eksponeres som `NEXT_PUBLIC_*`.

## Normal driftskontroll

1. Kontroller at siste `main` har grønn GitHub Build og grønn Vercel-status.
2. Kontroller at siste planlagte `EHL auto sync` er grønn.
3. Kontroller `sync_runs`: ny kjøring omtrent hvert 5. minutt, `ok=true`, forventet importvolum og tom `error_message`.
4. Ved kampdag: kontroller at HockeyLive-resultater, Tipping-scoring og Fantasy-livssyklus beveger seg som forventet etter ferdig kamp.
5. Ved database-/auth-mistanke: kontroller Supabase prosjektstatus og API/Auth/Postgres-logger før kode endres.

## Synkfeil og retry

- HockeyLive-requester har intern timeout på 10 sekunder.
- GitHub cron bruker `curl --retry 2 --max-time 45`.
- Delvis feil i standings, Fantasy-kampbehandling, round automation eller snapshots gjør hele kjøringen `ok=false`, skriver `sync_runs.error_message` og gir HTTP 500 slik at cron kan retry-e.
- Synkflyten er bygget rundt upsert/idempotente produksjonsfunksjoner; retry skal ikke omgå eksisterende scoring-/snapshot-/deadline-gater.
- Ved gjentatt feil: ikke endre scoring/data manuelt før årsaken er identifisert. Bruk `sync_runs`, GitHub-run og Supabase-logger sammen.

## Admin og manuell produksjonshåndtering

- Administrative API-ruter skal alltid validere Supabase-bruker og `players.admin` før service-key-operasjoner.
- Manuell synk skal gå gjennom eksisterende adminflyt `/api/admin/sync`, ikke ved å eksponere cron-secret eller service key i klienten.
- Kampkorrigering skal bruke adminverktøyet som revaliderer lagret kamp og re-scorer, ikke direkte ad-hoc SQL i normal drift.
- Migrations kjøres kontrollert og skal ligge i repoet. Ikke rediger produksjonsschema fra tilfeldige SQL-snutter uten sporbar migrasjon.

## Sikkerhet

- Auth/onboarding er fail-closed: brukerinnhold rendres ikke før session/profil er verifisert.
- Ufullstendig profil sendes til onboarding.
- `anon` skal ikke ha direkte EXECUTE på interne `SECURITY DEFINER`-/triggerfunksjoner.
- Service-only tabeller har RLS og ingen klientpolicies; direkte tabellprivilegier for `anon`/`authenticated` er fjernet der de ikke trengs.
- Vanlige authenticated RPC-er som trenger `SECURITY DEFINER` skal alltid avgrense mot `auth.uid()` eller eksplisitt admin/service-role-gate.

## Vercel rollback

Ved kode-/deploy-regresjon:

1. Identifiser siste dokumenterte grønn produksjonsdeploy/commit før feilen.
2. Foretrekk Vercel rollback/promote til kjent grønn deploy eller en kontrollert Git-revert på `main`; ikke force-push historikk.
3. Etter rollback: verifiser produksjonsalias, auth/onboarding, en sentral Fantasy-side, en sentral Tipping-side og `/api/sync-ehl` via neste cron-run.
4. Kontroller at databasen ikke fikk en inkompatibel migrasjon fra den dårlige deployen. Koderollback ruller ikke databasen tilbake automatisk.

## Database rollback og backup

Databaseendringer skal normalt repareres med en fremoverrettet migrasjon. Databaserestore brukes ved reelt datatap/korrupsjon, ikke som standard kode-rollback.

**Launch-forutsetning verifisert 2026-08-25:** Supabase-organisasjonen `Hockeytips` er kontrollert direkte og står på **Pro**. Dermed er planforutsetningen for Supabase managed backups etablert før MP-14. Backup/restore inngår fortsatt som eksplisitt operativ kontroll i MP-14 launch-gaten; ingen backupfil, databasepassord eller access token skal committes til repoet.

## Incident: Supabase/Data API

Ved 5xx/504 på tvers av appen:

1. Kontroller først Vercel deploy og Supabase prosjektstatus/loggene; ikke anta at siste feature-commit er årsaken.
2. Skill Auth fra Data API/PostgREST ved å se på Auth- og API-logger.
3. Ikke svekk RLS eller auth som workaround.
4. Restart av Supabase-prosjekt vurderes kun når Data API/databaseforbindelser er fastlåst og etter at status/logg er kontrollert. Restart medfører kort nedetid, men skal ikke brukes som første tiltak ved vanlig kodefeil.
5. Etter gjenoppretting: verifiser Data API, auth, sync og brukerflate før incidenten lukkes.

## Handoff til MP-14

MP-14.1–14.7 skal bruke denne runbooken som driftsgrunnlag og gjøre siste launch-gate: regler, 45 runder/deadlines, miljø/secrets, cron, mobil/desktop smoke, backup/rollback og eksplisitt PASS/FAIL før GO LIVE.
