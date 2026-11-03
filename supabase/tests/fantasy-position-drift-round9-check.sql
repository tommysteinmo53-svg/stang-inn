-- Read-only regression checks for position drift affecting round 9.
-- Run before and after migration; both rows must return valid = true.
with target_round as (
 select id, deadline_at from public.fantasy_rounds
 where season='2026/27' and round_no=9
), resolved as (
 select t.name, tp.line_no, tp.is_captain, tp.is_vice_captain,
 coalesce((
  select sp.position from public.fantasy_team_round_snapshot_players sp
  join public.fantasy_team_round_snapshots s on s.id=sp.snapshot_id
  join public.fantasy_rounds r on r.id=s.round_id
  where s.team_id=t.id and sp.player_id=tp.player_id
   and r.deadline_at < (select deadline_at from target_round)
  order by r.deadline_at desc limit 1
 ), fp.position) as pos
 from public.fantasy_user_teams t
 join public.fantasy_user_team_players tp on tp.team_id=t.id
 join public.fantasy_players fp on fp.id=tp.player_id
 where t.season='2026/27' and t.name in ('Kfk','Team Raptor')
), counts as (
 select name,
 count(*) as players,
 count(*) filter (where pos in ('C','W')) as forwards,
 count(*) filter (where pos='D') as defenders,
 count(*) filter (where pos='G') as goalkeepers,
 count(*) filter (where is_captain) as captains,
 count(*) filter (where is_vice_captain) as vice_captains,
 count(*) filter (where line_no=1 and pos in ('C','W')) as first_forwards,
 count(*) filter (where line_no=2 and pos in ('C','W')) as second_forwards,
 count(*) filter (where line_no=1 and pos='D') as first_defenders,
 count(*) filter (where line_no=2 and pos='D') as second_defenders,
 count(*) filter (where line_no=1 and pos='G') as first_goalkeepers,
 count(*) filter (where line_no=2 and pos='G') as second_goalkeepers
 from resolved group by name
)
select name,
 players=12 and forwards=6 and defenders=4 and goalkeepers=2
 and captains=1 and vice_captains=1
 and first_forwards=3 and second_forwards=3
 and first_defenders=2 and second_defenders=2
 and first_goalkeepers=1 and second_goalkeepers=1 as valid
from counts order by name;
