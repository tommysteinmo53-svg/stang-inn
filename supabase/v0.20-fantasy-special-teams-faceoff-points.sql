-- Stang Inn Fantasy Hockey – v0.20
-- Activate special-teams and faceoff scoring for 2026/27.
-- Safe to run repeatedly.

insert into fantasy_scoring_rules(season,key,points,position,active)
values
  ('2026/27','powerplay_goal_bonus',2,null,true),
  ('2026/27','powerplay_assist_bonus',1,null,true),
  ('2026/27','shorthanded_goal_bonus',6,null,true),
  ('2026/27','shorthanded_assist_bonus',4,null,true),
  ('2026/27','faceoff_win_points',0.25,null,true)
on conflict(season,key,position)
do update set
  points=excluded.points,
  active=excluded.active;

-- No separate threshold/one-time faceoff bonus is used.
insert into fantasy_scoring_rules(season,key,points,position,active)
values ('2026/27','faceoff_win_bonus',0,null,true)
on conflict(season,key,position)
do update set points=excluded.points,active=excluded.active;
