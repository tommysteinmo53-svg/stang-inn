# Fantasy Hockey – datakilde

## Primærkilde: HockeyLive

For EHL 2025/26 er følgende identifikatorer bekreftet:

- `seasonId=201059`
- `tournamentId=435587`

Offentlige sider:

- Terminliste: `https://live.hockey.no/schedule?seasonId=201059&tournamentId=435587`
- Kamp: `https://live.hockey.no/match?seasonId=201059&tournamentId=435587&matchId={matchId}&matchDate={date}`
- Spillertropp: `https://live.hockey.no/teammembers?seasonId=201059&tournamentId=435587`
- Lagstatistikk: `https://live.hockey.no/statistics/teams?seasonId=201059&tournamentId=435587`

Et konkret EHL-kamp-ID-format er bekreftet, eksempel `matchId=8183256`.

## Hva Fantasy-importen trenger

Per kamp:

- kamp-ID og dato
- hjemme-/bortelag
- sluttresultat/status
- spiller-ID/navn/lag/posisjon
- deltakelse
- mål
- assists
- skudd på mål
- plus/minus
- utvisningsminutter
- keeperredninger
- keeperens innslupne mål
- keeperseier
- keeper-shutout

Dette dekker de publiserte 19Fantasy-reglene.

## Importstrategi

1. Hent terminliste og opprett/oppdater `fantasy_games`.
2. For ferdigspilte kamper hentes kamp/boxscore.
3. Match eksterne spiller-ID-er mot `fantasy_players`.
4. Upsert kampstatistikk i `fantasy_player_game_stats`.
5. Behold rå kildepayload i `raw` slik at parseren kan rettes uten å miste originaldata.
6. Kjør 19Fantasy-poengmotor etter vellykket import.

## Teknisk status

HockeyLive-sidene og stabile URL-parametre er bekreftet som offentlig tilgjengelige. Selve klientens interne JSON-endepunkt er ikke dokumentert offentlig og er derfor ikke hardkodet før det er verifisert. Importlaget skal isolere kildeadapteren slik at endpoint/parser kan byttes uten å endre poengmotor eller dashboard.

Sekundær kontrollkilde: EHL/Wisehockey-statistikk brukes til validering av sesongsummer, ikke som førstevalg for kampvis import.
