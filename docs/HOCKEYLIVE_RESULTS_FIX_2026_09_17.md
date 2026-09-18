# Published results and standings — 17 September 2026

The feed contains four completed matches, but the old adapter ignored nested matchResult scores and treated administrative statusTypeId=1 (Opprettet) as unplayed. HockeyLive's own frontend match-state selector (NI in index-VDtGmV5C.js, inspected 17 September) classifies non-null matchResult as FINISHED. We require numeric nonnegative scores and a matching matchEndResult string before accepting this published result. Live scores alone do not finalize a match.

Standings use totalMatches and totalPoints, including negative points such as Lillehammer's -3. Import official points rather than deriving them from wins. Withdrawn Sparta remains filtered by the existing season logic.

The shared result adapter is used in the scheduled match provider and Fantasy's fallback/season imports. Fantasy no longer overwrites official final scores by recounting goal events, which can diverge in shootouts. Goal-count fallback cannot finalize a scheduled match.

Verification: offline regression for scheduled/live/malformed results, zero scores, published final with administrative status 1, standings fields and tipping points. Replay of downloaded production source: 180 matches, four finals, eight team appearances and nine net table points after Lillehammer's deduction. Existing tipping and Fantasy scoring regressions pass. CI runs the new regression.

Production recovery uses the ordinary scheduled sync and scoring lifecycle; no manual points or snapshots are invented.

## Production identity gate follow-up
The first live recovery run updated four finals, 33 tips and the table. Fantasy processed two games, while Vålerenga–Oilers stopped at the existing EP-provisional identity gate. The source now uses new IDs for Ludwig Blomstrand and the Westerholm brothers. Explicit reviewed source-to-existing-external-ID aliases are applied in base import and enrichment; existing UUIDs, prices and ownership are retained. The duplicate Ponthus row already created by the old importer has no ownership/snapshots/points. A guarded, archived migration moves its partial stats to the original UUID and disables the duplicate. Sync diagnostics now record per-match errors instead of only a count.
