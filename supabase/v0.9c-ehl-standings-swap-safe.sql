-- Stang Inn v0.9c – gjør tabellplasseringer trygge ved plassbytte
-- Kjør etter v0.9-ehl-standings.sql.

alter table public.ehl_standings
  drop constraint if exists ehl_standings_season_position_key;

alter table public.ehl_standings
  add constraint ehl_standings_season_position_key
  unique (season, position)
  deferrable initially deferred;
