# Nitten source scan fix — 17 September 2026

Nitten's Webflow byline renders each date component and dot in its own div. The availability sentence extractor adds punctuation at closing divs, so publication-date parsing rejected all six homepage articles as undated. Date extraction now uses plain whitespace while injury evidence retains sentence boundaries.

The parser also recognizes explicit “er ute” in coordinated player lists, including names following “sammen med”. Clause boundaries and negative healthy-player cases are tested. Findings still go through the existing roster matching, deduplication and admin review; this change does not publish player availability or write production data.

Validation:
- Production scan tested with downloaded homepage and the reported article: discovery succeeds, date is 2026-09-17, ten named absence candidates are extracted using a fixture roster. This is not a claim that ten production roster matches or queue inserts have been made.
- Existing two historical articles: 18/18 and 27/27 expected findings unchanged.
- Offline regression covers Webflow date markup, invalid/missing dates, stale/future rejection, coordinated absence, healthy players, clause boundaries and the read-only pipeline check. Included in CI as `npm run test:availability:nitten`.

Reported article: https://www.nitten.no/blogg/for-dropp-fulltallige-i-storkampen-stjernen-fravaer-i-nord

After deployment, run “Skann webkilder” to populate the normal review queue. No automatic status approval is performed.

## Follow-up: real roster names

The first test used article names as roster names and missed a production mismatch: nine of the ten players have additional given/middle names in fantasy_players. The production query returns 214 active/current players. A read-only replay with that complete roster now finds all ten named players, with ten distinct proposed IDs. Nine shortened names require manual review; Eskil Wold remains an exact match.

The scan searches full names and given-name/surname variants, retains the article name as evidence, and never guesses by surname alone. Ambiguous variants remain unresolved. Short-name proposals use a null match_method (compatible with the existing database constraint), an explanatory reason and needs_review. Repeated mentions of the same proposed player in an article are deduplicated. The ten real name pairs and ambiguity cases are included in the offline regression. No production status is automatically approved.
