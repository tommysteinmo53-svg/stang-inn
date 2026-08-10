# Offentlig fallback for Fantasy-data

Stang Inn skal ikke være avhengig av partner-token fra NIF for Fantasy-modulen.

## Strategi

1. Terminliste og resultater hentes fra den eksisterende offentlige HockeyLive/TournamentMatches-flyten.
2. Spiller- og keeperstatistikk forsøkes hentet fra offentlig tilgjengelige HockeyLive/EHL-sider.
3. Datakilden ligger bak en egen adapter slik at vi kan endre parser uten å endre poengmotor, analyser eller UI.
4. Før vi skriver offentlig statistikk til databasen kjører vi et beskyttet diagnose-endepunkt som rapporterer hvilke strukturerte data og tabellfelter siden faktisk eksponerer.

## Diagnose-endepunkt

`GET /api/fantasy-public-probe`

Endepunktet krever samme `Authorization: Bearer <CRON_SECRET>` som andre server-synker.

Valgfrie query-parametre:

- `seasonId`
- `tournamentId`

Standardverdiene peker på HockeyLive-data som kan overstyres med miljøvariablene `HOCKEYLIVE_SEASON_ID` og `HOCKEYLIVE_TOURNAMENT_ID`.

Responsen inneholder blant annet HTTP-status, HTML-størrelse, funn av innebygd JSON, mulige statistikkrader og tabelloverskrifter. Dette brukes kun til å validere offentlig datatilgang og velge riktig parser.

## Validering før masseimport

Vi skal ikke masseimportere før én kjent kamp kan sammenlignes mot HockeyLive/EHL for minst:

- mål
- assists
- skudd på mål
- plus/minus
- utvisningsminutter
- keeperredninger
- innslupne mål

Når disse feltene stemmer, kobles parseren inn i `fantasy_player_game_stats` og punkt 3 kan markeres som ferdig.
