-- Read-only dry run of expected scoring changes, derived from the staged 14 events.
-- No INSERT, UPDATE, DELETE, or RPC calls. Values are cumulative event totals,
-- NOT additive deltas. This intentionally does not award points.
with staged(external_id, player_external_id, goals, assists, pp_goals, pp_assists) as (
 values
 ('hockeylive:8393583','nif:6849262',1,0,0,0),
 ('hockeylive:8393583','nif:9459227',2,1,1,0),
 ('hockeylive:8393583','nif:10473631',1,2,1,0),
 ('hockeylive:8393583','nif:10440558',0,2,0,2),
 ('hockeylive:8393583','nif:8156791',0,1,0,0),
 ('hockeylive:8393583','nif:10589867',0,1,0,0),
 ('hockeylive:8393583','nif:8313562',0,1,0,0),
 ('hockeylive:8393583','nif:7151757',1,0,0,0),
 ('hockeylive:8393583','nif:8568129',0,1,0,0),
 ('hockeylive:8393583','nif:10589192',0,1,0,0),
 ('hockeylive:8393611','ep:244694',1,0,0,0),
 ('hockeylive:8393611','nif:10379149',0,1,0,0),
 ('hockeylive:8393611','nif:7531512',0,1,0,0),
 ('hockeylive:8393611','nif:10188899',1,1,0,0),
 ('hockeylive:8393611','nif:5488470',0,1,0,0),
 ('hockeylive:8393611','nif:9430975',1,0,1,0),
 ('hockeylive:8393611','nif:7818088',0,1,0,1),
 ('hockeylive:8393611','nif:5656129',0,1,0,1),
 ('hockeylive:8393611','nif:7738536',1,2,0,1),
 ('hockeylive:8393611','nif:7738552',3,0,1,0),
 ('hockeylive:8393611','nif:10379236',0,2,0,1),
 ('hockeylive:8393611','nif:9830252',1,0,0,0),
 ('hockeylive:8393611','nif:5502138',0,1,0,0),
 ('hockeylive:8393611','nif:4532203',0,1,0,0),
 ('hockeylive:8393611','nif:7747130',1,0,0,0),
 ('hockeylive:8393611','nif:8309849',0,1,0,0)
)
select staged.external_id,p.name,staged.player_external_id,
       s.goals as current_goals,staged.goals as proposed_goals,
       s.assists as current_assists,staged.assists as proposed_assists,
       s.powerplay_goals as current_pp_goals,staged.pp_goals as proposed_pp_goals,
       s.powerplay_assists as current_pp_assists,staged.pp_assists as proposed_pp_assists,
       case when p.id is null or s.player_id is null then 'BLOCK_MISSING_ROSTER_ROW'
            when coalesce(s.goals,0)<>0 or coalesce(s.assists,0)<>0 then 'BLOCK_NONZERO_EXISTING_SCORING'
            else 'DRY_RUN_ONLY' end as safety_status
from staged
left join public.fantasy_games g on g.external_id=staged.external_id and g.season='2026/27'
left join public.fantasy_players p on p.external_id=staged.player_external_id
left join public.fantasy_player_game_stats s on s.game_id=g.id and s.player_id=p.id
order by staged.external_id,p.name;
