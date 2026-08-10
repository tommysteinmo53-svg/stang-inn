# Fantasy Hockey – automatisk EHL-data

## Kilder

Terminliste/resultater bruker den eksisterende Stang Inn-synken mot HockeyLive/NIF TournamentMatches.

Kampstatistikk bruker NIF Data API sine offisielle ishockey-endepunkter:

- `GET /api/v1/icehockey/Match/Players/{matchId}`
- `GET /api/v1/icehockey/Match/GoalieLeaders/{matchId}`
- `GET /api/v1/icehockey/Match/Goals/{matchId}`
- `GET /api/v1/icehockey/Match/Penalties/{matchId}`

Datakilden er isolert i `lib/fantasy/nif-client.ts` slik at normalisering og poenglogikk ikke er avhengig av leverandøren.

## Dataflyt

`TournamentMatches -> matches -> fantasy_games -> NIF kampstatistikk -> fantasy_players + fantasy_player_game_stats -> poengmotor`

## Miljøvariabler

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `NIF_DATA_TOKEN` for NIF-endepunkter som krever partner-scope
- `NIF_SEASON_LABEL=2026/27`
- `CRON_SECRET`

## Migrasjon

Kjør etter v0.5:

`supabase/v0.6-fantasy-import.sql`

Denne migrasjonen endrer fantasyposisjoner til `G`, `D`, `W`, `C` og legger til eksplisitt kampdeltakelse.

## Import-endepunkt

Beskyttet server-endepunkt:

`/api/admin/fantasy/import`

### Terminliste

`GET` speiler gjeldende sesong fra `matches` til `fantasy_games`.

### Enkeltkamp

`POST` med JSON:

```json
{ "matchId": 1234567 }
```

henter skater- og keeperstatistikk og upserter spiller/kamp-statistikk.

Begge kall krever `Authorization: Bearer <CRON_SECRET>`.

## Validering før full sesongsynk

1. Kjør migrasjon v0.6.
2. Synk terminliste.
3. Velg én ferdigspilt EHL-kamp.
4. Importer kampens `matchId`.
5. Sammenlign G, A, SOG, +/-, PIM, saves og GA mot HockeyLive.
6. Først når én kamp er 100 % riktig, aktiveres masseimport.

`Goals` og `Penalties` lagres foreløpig som kontrollkilder i importresultatet; spillerstatistikken er primærkilden for summerte fantasy-felter.
