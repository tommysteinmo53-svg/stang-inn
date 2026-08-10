-- Stang Inn Fantasy Hockey – v0.6
-- Import-ready fields for exact 19Fantasy positions and participation.

alter table fantasy_players
  drop constraint if exists fantasy_players_position_check;

alter table fantasy_players
  add constraint fantasy_players_position_check
  check (position in ('G','D','W','C'));

alter table fantasy_player_game_stats
  add column if not exists did_play boolean not null default false,
  add column if not exists position_snapshot text,
  add column if not exists team_snapshot text;

create index if not exists fantasy_stats_game_idx
  on fantasy_player_game_stats(game_id);

create index if not exists fantasy_players_external_idx
  on fantasy_players(external_id);
