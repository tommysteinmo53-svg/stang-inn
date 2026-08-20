-- Stang Inn Fantasy Hockey – v0.58
-- Performance-only indexes for xFP/optimizer fixture matching.
-- Keeps xFP formulas, scoring, and MP-09 availability policy unchanged.
-- Root cause: get_fantasy_xfp_admin_v1 matches every active player against upcoming
-- fantasy_games through fantasy_team_key(home_team/away_team). Without expression
-- indexes PostgreSQL repeatedly normalizes team names across the full player x game set.

create index if not exists fantasy_games_season_home_team_key_starts_at_idx
  on public.fantasy_games (
    season,
    public.fantasy_team_key(home_team),
    starts_at
  )
  where coalesce(status,'scheduled') not in ('finished','cancelled');

create index if not exists fantasy_games_season_away_team_key_starts_at_idx
  on public.fantasy_games (
    season,
    public.fantasy_team_key(away_team),
    starts_at
  )
  where coalesce(status,'scheduled') not in ('finished','cancelled');

comment on index public.fantasy_games_season_home_team_key_starts_at_idx is
  'Speeds xFP/optimizer matching of upcoming home fixtures by normalized Fantasy team key.';

comment on index public.fantasy_games_season_away_team_key_starts_at_idx is
  'Speeds xFP/optimizer matching of upcoming away fixtures by normalized Fantasy team key.';
