# MP-09 – Availability source policy

This document defines the source and safety policy for automatic injury/absence discovery in Stang Inn Fantasy.

## Core rule

External information is never authoritative by itself. Automatic collection may only create a row in `fantasy_availability_findings`. A human fantasy admin must explicitly approve a verified player match before `fantasy_player_availability` can change.

## Supported source classes

1. **Official EHL club websites** – primary source for club-confirmed injury, illness, suspension, return-to-training and squad information.
2. **nitten.no** – editorial hockey source used for documented EHL injury/absence reporting.
3. **HockeyLive / official match squad data** – separate structured source for `not_in_lineup`; absence from a lineup must not be interpreted as injury without another source.
4. Other sources may be entered manually, but are not part of the automatic scanner unless explicitly reviewed and added to the allowlist.

## Web scanner safety gates

The web scanner is deterministic and admin-triggered. It may create a candidate only when all of the following are true:

- the URL belongs to an allowlisted source;
- the page exposes a parseable publication timestamp;
- the publication timestamp is no older than 45 days;
- an active current-roster player's name occurs in the article text;
- availability language occurs close enough to that player mention to classify a candidate status;
- the candidate passes the existing conservative roster matcher.

The scanner does not infer a player from surname fragments, position, jersey number or similarity alone.

## HockeyLive match-squad gate

HockeyLive is handled separately from prose sources. The scanner checks only linked 2026/27 preseason matches from the latest three days and requires the public `MatchTeamMembers` dataset to be available. Both teams must have at least 10 identified team members before absence detection is allowed; otherwise the match is skipped as incomplete.

A current-roster player who cannot be found in that team's MatchTeamMembers by NIF person ID or exact normalized full name may create a `not_in_lineup` finding. The finding records match ID, game and date. It never infers injury, illness or suspension. The same explicit admin approval requirement applies before current availability can change.

## Status interpretation

- `not_in_lineup`: source explicitly says the player is outside/not in the match squad, or a complete-enough HockeyLive MatchTeamMembers dataset omits a current-roster player. This does **not** imply injury.
- `out`: explicit injury, illness, suspension/ban, stands over, or not match-ready.
- `long_term`: explicit long-term absence, rest-of-season absence, or multi-week/month wording.
- `questionable`: explicit uncertain/day-to-day wording.
- `returning`: explicit return to training/ice/comeback wording.

A source saying only that a player did not play is insufficient to infer an injury reason.

## Matching and approval

Name + club may produce a proposed roster match. Missing club, club mismatch, duplicate names or no exact roster identity require manual review. A proposed match is still non-authoritative.

Approval is an explicit admin action. The approval RPC verifies that the proposed player is still on the active current roster, then atomically:

1. updates current availability;
2. appends availability history;
3. marks the finding approved.

If any operation fails, the transaction is rolled back.

## Deduplication and freshness

Automatic findings are deduplicated by source URL + player name + proposed status. Source publication time is stored with the finding and later copied into authoritative availability on approval.

Pages without a parseable publication time are skipped by the web scanner and may still be handled manually if needed. This intentionally favors missed candidates over stale or misleading automatic findings.

## Scope

Automatic source collection is discovery only. It must not directly change xFP, recommendations, optimizer output or user-facing player availability. Only admin-approved `fantasy_player_availability` is eligible for later MP-09.6 integration.
