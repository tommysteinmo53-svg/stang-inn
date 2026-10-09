-- Read-only preflight for the two incomplete 2026/27 HockeyLive games.
-- Execute in Supabase SQL editor. This script does not change production data.
with target_games as (
  select id, external_id, home_score, away_score
  from public.fantasy_games
  where season = '2026/27'
    and external_id in ('hockeylive:8393583', 'hockeylive:8393611')
), game_totals as (
  select g.id, g.external_id, g.home_score, g.away_score,
         count(s.player_id) as stat_rows,
         coalesce(sum(s.goals),0) as goals_in_stats,
         coalesce(sum(s.assists),0) as assists_in_stats
  from target_games g
  left join public.fantasy_player_game_stats s on s.game_id = g.id
  group by g.id,g.external_id,g.home_score,g.away_score
), target_people(external_id, display_name, player_external_id) as (
  values
    ('hockeylive:8393583','Thomas Bækken','nif:6849262'),
    ('hockeylive:8393583','Samuel Salonen','nif:9459227'),
    ('hockeylive:8393583','Mateusz Szurowski','nif:10473631'),
    ('hockeylive:8393583','Albert Lyckåsen','nif:10440558'),
    ('hockeylive:8393583','Thomas Higson','nif:8156791'),
    ('hockeylive:8393583','Isac Andersson','nif:10589867'),
    ('hockeylive:8393583','Jens Jøsok Holstad','nif:8313562'),
    ('hockeylive:8393583','Isak Pantzare','nif:10589192'),
    ('hockeylive:8393611','Ponthus Westerholm','nif:7738536'),
    ('hockeylive:8393611','Pathrik Westerholm','nif:7738552'),
    ('hockeylive:8393611','Henrik Larsson','nif:10379236'),
    ('hockeylive:8393611','Adam Bäckehag','nif:10188899'),
    ('hockeylive:8393611','Aron Jessli','nif:9430975'),
    ('hockeylive:8393611','Ken Andre Olimb','nif:5656129'),
    ('hockeylive:8393611','Jørgen Karterud','nif:7818088')
), roster_checks as (
  select t.external_id, t.display_name, t.player_external_id,
         p.id as player_id, p.name as database_name,
         s.player_id is not null as has_game_stat_row,
         coalesce(s.goals,0) as current_goals,
         coalesce(s.assists,0) as current_assists
  from target_people t
  left join target_games g on g.external_id=t.external_id
  left join public.fantasy_players p on p.external_id=t.player_external_id
  left join public.fantasy_player_game_stats s on s.game_id=g.id and s.player_id=p.id
)
select 'GAME' as kind, external_id, null::text as player, null::text as player_external_id,
       format('score=%s-%s stats=%s goals=%s assists=%s',home_score,away_score,stat_rows,goals_in_stats,assists_in_stats) as detail
from game_totals
union all
select 'PLAYER',external_id,display_name,player_external_id,
       format('name=%s game_row=%s current=%sG/%sA',coalesce(database_name,'MISSING'),has_game_stat_row,current_goals,current_assists)
from roster_checks
order by external_id,kind,player;
