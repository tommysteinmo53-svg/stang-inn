# Two-match scoring recovery — identity reconciliation (2026/27)

Status: **preflight only — DO NOT write production scoring**.

## Match identities

- `hockeylive:8393583`: Ringerike–Narvik, 4–1, five goal events missing from imported player stats.
- `hockeylive:8393611`: Vålerenga–Nidaros, 6–3, nine goal events missing from imported player stats.

All event claims from third-party reports must be checked against the official match report before applying changes. A name match alone is never sufficient. The database may contain duplicate fantasy player records.

## Confirmed roster identities to validate

| Match | Display name | Fantasy player external ID | Notes |
|---|---|---|---|
| 8393583 | Thomas Bækken | nif:6849262 | roster row present |
| 8393583 | Samuel Salonen | nif:9459227 | roster row present |
| 8393583 | Mateusz Szurowski | nif:10473631 | roster row present |
| 8393583 | Albert Lyckåsen | nif:10440558 | roster row present |
| 8393583 | Thomas Higson | nif:8156791 | roster row present |
| 8393583 | Isac Andersson | nif:10589867 | roster row present |
| 8393583 | Jens Jøsok Holstad | nif:8313562 | roster row present |
| 8393583 | Isak Pantzare | nif:10589192 | roster row present |
| 8393611 | Ponthus Westerholm | nif:7738536 | use rostered/canonical fantasy identity; duplicate nif:10603533 also exists |
| 8393611 | Pathrik Westerholm | nif:7738552 | separate player from Ponthus |
| 8393611 | Henrik Larsson | nif:10379236 | roster row present |
| 8393611 | Adam Bäckehag | nif:10188899 | roster row present |
| 8393611 | Aron Jessli | nif:9430975 | roster row present |
| 8393611 | Ken Andre Olimb | nif:5656129 | roster row present |
| 8393611 | Jørgen Karterud | nif:7818088 | roster row present |

## Blockers that require human/source verification

1. **RESOLVED** Narvik scorer #41 D. Byrkjeland = Douglas Emrik Byrkjeland (`nif:7151757`), not Kåre Benjamin Byrkjeland (#20). Source: https://hockey.nif.no/live/BoxScore/Boxscore/8393583 and https://www.hockey4you.no/kampsenter/?kamp=8393583 .
2. **RESOLVED** Narvik assist #57 E. Vold = Esbjørn Leiv Fogstad Vold (`nif:8568129`). Same official boxscore and Hockey4You roster sources.
3. **LIKELY RESOLVED, needs official final boxscore confirmation**: Nidaros assist #36 O. Indergaard is rostered Ole Indergaard (`nif:8309849`), not the previously stated 'Oskar Indergaard'. Flashscore credits O. Indergaard: https://www.flashscore.fr/match/hockey/nidaros-QXuY3vcR/valerenga-rHMTGU45/ ; roster #36: https://www.hockey4you.no/kampsenter/?kamp=8393611 .
4. Nidaros goal scorer Alexander Bjurström currently has `ep:244694` rather than a NIF identity in the match stats. Verify this is the intended fantasy identity.
5. Verify goal type (PP, SH, penalty shot, empty net), home/away score progression, exact assists and timestamp for every event. Ponthus scored a **penalty-shot goal during play**, not a shootout winner (Vålerenga report: https://www.vif-hockey.no/article/r5satml-49ejd/view). Note that Hockey4You match 8393611 currently serves an outdated LIVE 2–2 partial snapshot; do not use it as a final 6–3 event source. Use Flashscore and the Vålerenga club report for final scoring.

## Verified source references

- Official NIF Ringerike–Narvik boxscore: https://hockey.nif.no/live/BoxScore/Boxscore/8393583
- Ringerike–Narvik full roster and named events: https://www.hockey4you.no/kampsenter/?kamp=8393583
- Vålerenga–Nidaros final scoring: https://www.flashscore.fr/match/hockey/nidaros-QXuY3vcR/valerenga-rHMTGU45/
- Vålerenga club report: https://www.vif-hockey.no/article/r5satml-49ejd/view

## Safe repair sequence

1. Obtain and archive source evidence for each event, including source URL, scorer, assist identities, event time, strength and team.
2. Resolve every event participant to exactly one rostered `fantasy_players.id` with no name-only fuzzy fallback.
3. Run `scripts/audit-fantasy-two-incomplete-games.sql` read-only. Require expected 5+9 goals and 0 unknown participants.
4. Implement an explicit, idempotent two-match repair using stable external IDs, source provenance and a dry-run report. Abort if production stats have changed since preflight.
5. Recalculate player points, round scores, snapshots and leaderboards through the authoritative scoring pipeline. Validate before/after totals and keep rollback data.
6. Do not merge or execute production writes before source verification and regression tests pass.

The current automatic HockeyLive endpoint may return zero goal events for these games. Repeated imports from the same incomplete feed will not repair them.
