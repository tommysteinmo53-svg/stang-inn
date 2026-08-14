-- Stang Inn Fantasy Hockey – v0.14
-- Special-teams scoring foundation.
-- Adds separate goal/assist counters for PP and SH situations and creates
-- configurable scoring rules. All four bonus values start at 0 for 2026/27.

alter table fantasy_player_game_stats
  add column if not exists powerplay_assists integer not null default 0,
  add column if not exists shorthanded_assists integer not null default 0;

-- Existing columns:
-- powerplay_goals
-- shorthanded_goals
-- New columns above complete the 2x2 matrix:
-- PP goal / PP assist / SH goal / SH assist.

insert into fantasy_scoring_rules(season, key, points, position, active)
values
  ('2026/27', 'powerplay_goal_bonus', 0, null, true),
  ('2026/27', 'powerplay_assist_bonus', 0, null, true),
  ('2026/27', 'shorthanded_goal_bonus', 0, null, true),
  ('2026/27', 'shorthanded_assist_bonus', 0, null, true)
on conflict (season, key, position)
do update set
  points = excluded.points,
  active = excluded.active;

comment on column fantasy_player_game_stats.powerplay_assists is
  'Assists recorded while the player team is on the power play.';
comment on column fantasy_player_game_stats.shorthanded_assists is
  'Assists recorded while the player team is shorthanded.';
