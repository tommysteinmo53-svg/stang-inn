-- Atomic recovery of the nine officially verified goals in Vålerenga–Nidaros.
-- Intentionally ROLLBACK-only until round leaderboard recomputation is wired in.
-- Requires existing 42 game stat rows, 42 point rows and all 16 identities.
begin;
create temporary table recovery_scoring(external_id text primary key,goals integer,assists integer,pp_goals integer,pp_assists integer) on commit drop;
insert into recovery_scoring values
('ep:244694',1,0,0,0),
('nif:10379149',0,1,0,0),
('nif:7531512',0,1,0,0),
('nif:10188899',1,1,0,0),
('nif:5488470',0,1,0,0),
('nif:9430975',1,0,1,0),
('nif:7818088',0,1,0,1),
('nif:5656129',0,1,0,1),
('nif:7738536',1,2,0,1),
('nif:7738552',3,0,1,0),
('nif:10379236',0,2,0,1),
('nif:9830252',1,0,0,0),
('nif:5502138',0,1,0,0),
('nif:4532203',0,1,0,0),
('nif:7747130',1,0,0,0),
('nif:8309849',0,1,0,0);
do $$
declare matched integer;
begin
 select count(*) into matched
 from recovery_scoring r
 join public.fantasy_players p on p.external_id=r.external_id
 join public.fantasy_player_game_stats s on s.player_id=p.id
 join public.fantasy_games g on g.id=s.game_id
 where g.external_id='hockeylive:8393611' and g.season='2026/27'
 and g.status='finished' and coalesce(s.goals,0)=0 and coalesce(s.assists,0)=0;
 if matched<>16 then raise exception 'Expected 16 unchanged roster stats, got %',matched; end if;
 if (select count(*) from public.fantasy_player_points
     where game_id=(select id from public.fantasy_games where external_id='hockeylive:8393611'))<>42
 then raise exception 'Expected 42 existing materialized point rows'; end if;
end $$;
-- No UPDATE yet: points and team-round totals must be recalculated in the
-- same controlled maintenance workflow; this script is a validated preflight.
select count(*) as mapped_players,sum(goals) as goals,sum(assists) as assists,
sum(pp_goals) as powerplay_goals,sum(pp_assists) as powerplay_assists
from recovery_scoring;
rollback;
