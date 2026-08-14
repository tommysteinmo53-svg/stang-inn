-- Stang Inn Fantasy Hockey – v0.43
-- Dynamic, position-aware opponent factor for xFP.
-- Preseason anchor is gradually replaced by actual 2026/27 GF/GA as games are played.
-- Does not affect actual Fantasy scoring.

create or replace function fantasy_xfp_preseason_factor(p_team text)
returns numeric
language sql
immutable
set search_path=public
as $$
  select case fantasy_team_key(p_team)
    when 'storhamar' then 0.80::numeric
    when 'valerenga' then 0.86::numeric
    when 'frisk' then 0.90::numeric
    when 'stavanger' then 0.94::numeric
    when 'narvik' then 0.99::numeric
    when 'sparta' then 1.04::numeric
    when 'stjernen' then 1.08::numeric
    when 'lillehammer' then 1.13::numeric
    when 'lorenskog' then 1.20::numeric
    when 'nidaros' then 1.24::numeric
    when 'ringerike' then 1.28::numeric
    else 1.00::numeric
  end;
$$;

create or replace function fantasy_xfp_opponent_factor(
  p_opponent text,
  p_position text,
  p_season text default '2026/27'
)
returns numeric
language plpgsql
stable
set search_path=public
as $$
declare
  v_key text:=fantasy_team_key(p_opponent);
  v_games integer:=0;
  v_team_gf numeric;
  v_team_ga numeric;
  v_league_goals numeric;
  v_live numeric:=1;
  v_pre numeric:=fantasy_xfp_preseason_factor(p_opponent);
  v_live_weight numeric:=0;
  v_result numeric;
begin
  with team_results as (
    select
      case when fantasy_team_key(g.home_team)=v_key then g.home_score::numeric else g.away_score::numeric end as gf,
      case when fantasy_team_key(g.home_team)=v_key then g.away_score::numeric else g.home_score::numeric end as ga
    from fantasy_games g
    where g.season=p_season
      and g.home_score is not null
      and g.away_score is not null
      and (fantasy_team_key(g.home_team)=v_key or fantasy_team_key(g.away_team)=v_key)
  )
  select count(*)::integer,avg(gf),avg(ga)
  into v_games,v_team_gf,v_team_ga
  from team_results;

  select avg(x.goals)::numeric
  into v_league_goals
  from (
    select g.home_score::numeric as goals
    from fantasy_games g
    where g.season=p_season and g.home_score is not null and g.away_score is not null
    union all
    select g.away_score::numeric
    from fantasy_games g
    where g.season=p_season and g.home_score is not null and g.away_score is not null
  ) x;

  if v_games>0 and v_league_goals is not null and v_league_goals>0 then
    if p_position='G' then
      -- Keeper: low-scoring opponent is easier; high-scoring opponent is harder.
      if coalesce(v_team_gf,0)>0 then
        v_live:=power(v_league_goals/v_team_gf,1.15);
      else
        v_live:=1.35;
      end if;
    else
      -- Skater: team conceding many goals is easier; stingy defense is harder.
      if v_team_ga is not null then
        v_live:=power(v_team_ga/v_league_goals,1.15);
      end if;
    end if;
    v_live:=greatest(0.70::numeric,least(1.35::numeric,v_live));
  end if;

  -- 0 games = 100% preseason anchor; 6 games = 50/50; 12+ games = 100% live 2026/27 data.
  v_live_weight:=least(1::numeric,v_games::numeric/12::numeric);
  v_result:=(1-v_live_weight)*v_pre + v_live_weight*v_live;

  return round(greatest(0.70::numeric,least(1.35::numeric,v_result)),3);
end;
$$;

create or replace function get_fantasy_xfp_admin_v1(
  p_season text default '2026/27'
)
returns table(
  player_id uuid,player_name text,team text,player_position text,price numeric,
  games_scored integer,season_ppg numeric,form_ppg numeric,venue_ppg numeric,
  opponent text,next_game_at timestamptz,is_home boolean,opponent_factor numeric,
  next3_games integer,xfp_next_game numeric,xfp_next3 numeric,value_next3 numeric,data_confidence text
)
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_season_weight numeric;
  v_form_weight numeric;
  v_venue_weight numeric;
  v_opponent_weight numeric;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from players p where p.id=auth.uid() and p.admin=true) then raise exception 'Admin only'; end if;
  if p_season<>'2026/27' then raise exception 'Unsupported fantasy season: %',p_season; end if;

  select s.season_weight,s.form_weight,s.venue_weight,s.opponent_weight
  into v_season_weight,v_form_weight,v_venue_weight,v_opponent_weight
  from fantasy_xfp_settings s where s.season=p_season;
  if not found then raise exception 'xFP settings missing for season %',p_season; end if;

  return query
  with latest_points as (
    select distinct on(fpp.player_id,fpp.game_id)
      fpp.player_id,fpp.game_id,fpp.actual_points::numeric as actual_points,g.starts_at,g.home_team,g.away_team
    from fantasy_player_points fpp
    join fantasy_games g on g.id=fpp.game_id
    where g.season=p_season
    order by fpp.player_id,fpp.game_id,fpp.calculated_at desc,fpp.id desc
  ),
  season_form as (
    select lp.player_id,count(*)::integer as games_scored,avg(lp.actual_points)::numeric as season_ppg
    from latest_points lp group by lp.player_id
  ),
  ranked_form as (
    select lp.*,row_number() over(partition by lp.player_id order by lp.starts_at desc) as rn from latest_points lp
  ),
  recent_form as (
    select rf.player_id,avg(rf.actual_points)::numeric as form_ppg from ranked_form rf where rf.rn<=5 group by rf.player_id
  ),
  venue_splits as (
    select fp.id as player_id,
      avg(lp.actual_points) filter(where fantasy_team_key(lp.home_team)=fantasy_team_key(fp.team))::numeric as home_ppg,
      avg(lp.actual_points) filter(where fantasy_team_key(lp.away_team)=fantasy_team_key(fp.team))::numeric as away_ppg
    from fantasy_players fp left join latest_points lp on lp.player_id=fp.id group by fp.id
  ),
  upcoming_ranked as (
    select fp.id as player_id,fp.position as player_position,g.id as game_id,g.starts_at,
      case when fantasy_team_key(g.home_team)=fantasy_team_key(fp.team) then g.away_team else g.home_team end as opponent,
      (fantasy_team_key(g.home_team)=fantasy_team_key(fp.team)) as is_home,
      row_number() over(partition by fp.id order by g.starts_at,g.id) as rn
    from fantasy_players fp
    join fantasy_games g on fantasy_team_key(g.home_team)=fantasy_team_key(fp.team) or fantasy_team_key(g.away_team)=fantasy_team_key(fp.team)
    where g.season=p_season and g.starts_at>now() and coalesce(g.status,'scheduled') not in('finished','cancelled')
  ),
  fixture_components as (
    select ur.player_id,ur.game_id,ur.starts_at,ur.opponent,ur.is_home,ur.rn,
      coalesce(sf.season_ppg,0)::numeric as season_ppg,
      coalesce(rf.form_ppg,sf.season_ppg,0)::numeric as form_ppg,
      coalesce(case when ur.is_home then vs.home_ppg else vs.away_ppg end,sf.season_ppg,0)::numeric as fixture_venue_ppg,
      fantasy_xfp_opponent_factor(ur.opponent,ur.player_position,p_season)::numeric as fixture_opponent_factor
    from upcoming_ranked ur
    left join season_form sf on sf.player_id=ur.player_id
    left join recent_form rf on rf.player_id=ur.player_id
    left join venue_splits vs on vs.player_id=ur.player_id
    where ur.rn<=3
  ),
  fixture_xfp as (
    select fc.*,
      (v_season_weight*fc.season_ppg + v_form_weight*fc.form_ppg + v_venue_weight*fc.fixture_venue_ppg
       + v_opponent_weight*(fc.season_ppg*fc.fixture_opponent_factor))::numeric as fixture_xfp
    from fixture_components fc
  ),
  next_fixture as (
    select fx.player_id,fx.starts_at,fx.opponent,fx.is_home,fx.fixture_venue_ppg as venue_ppg,
      fx.fixture_opponent_factor as opponent_factor,fx.fixture_xfp as xfp_next_game
    from fixture_xfp fx where fx.rn=1
  ),
  next3_summary as (
    select fx.player_id,count(*)::integer as next3_games,sum(fx.fixture_xfp)::numeric as xfp_next3
    from fixture_xfp fx group by fx.player_id
  ),
  base as (
    select fp.id as player_id,fp.name as player_name,fp.team,fp.position as player_position,sp.price::numeric as price,
      coalesce(sf.games_scored,0) as games_scored,coalesce(sf.season_ppg,0)::numeric as season_ppg,
      coalesce(rf.form_ppg,sf.season_ppg,0)::numeric as form_ppg,coalesce(nf.venue_ppg,sf.season_ppg,0)::numeric as venue_ppg,
      nf.opponent,nf.starts_at as next_game_at,nf.is_home,coalesce(nf.opponent_factor,1)::numeric as opponent_factor,
      coalesce(n3.next3_games,0) as next3_games,coalesce(nf.xfp_next_game,0)::numeric as xfp_next_game,
      coalesce(n3.xfp_next3,0)::numeric as xfp_next3
    from fantasy_players fp
    left join fantasy_player_season_prices sp on sp.player_id=fp.id and sp.season=p_season
    left join season_form sf on sf.player_id=fp.id
    left join recent_form rf on rf.player_id=fp.id
    left join next_fixture nf on nf.player_id=fp.id
    left join next3_summary n3 on n3.player_id=fp.id
    where fp.active=true and fp.on_current_roster=true and sp.price is not null
  )
  select b.player_id,b.player_name,b.team,b.player_position,b.price,b.games_scored,
    round(b.season_ppg,2),round(b.form_ppg,2),round(b.venue_ppg,2),b.opponent,b.next_game_at,b.is_home,
    round(b.opponent_factor,3),b.next3_games,round(b.xfp_next_game,2),round(b.xfp_next3,2),
    case when b.price>0 then round(b.xfp_next3/b.price,3) else 0::numeric end,
    case when b.games_scored>=10 then 'high' when b.games_scored>=5 then 'medium' else 'low' end
  from base b order by b.xfp_next_game desc,b.player_name;
end;
$$;

create or replace function get_fantasy_xfp_player_fixtures_admin_v1(
  p_player_id uuid,p_season text default '2026/27'
)
returns table(
  player_id uuid,game_id uuid,fixture_no integer,starts_at timestamptz,opponent text,is_home boolean,
  season_ppg numeric,form_ppg numeric,venue_ppg numeric,opponent_factor numeric,fixture_xfp numeric
)
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_season_weight numeric;v_form_weight numeric;v_venue_weight numeric;v_opponent_weight numeric;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from players p where p.id=auth.uid() and p.admin=true) then raise exception 'Admin only'; end if;
  if p_season<>'2026/27' then raise exception 'Unsupported fantasy season: %',p_season; end if;
  if not exists(select 1 from fantasy_players fp where fp.id=p_player_id) then raise exception 'Fantasy player not found'; end if;

  select s.season_weight,s.form_weight,s.venue_weight,s.opponent_weight
  into v_season_weight,v_form_weight,v_venue_weight,v_opponent_weight
  from fantasy_xfp_settings s where s.season=p_season;
  if not found then raise exception 'xFP settings missing for season %',p_season; end if;

  return query
  with target_player as (
    select fp.id,fp.team,fp.position from fantasy_players fp where fp.id=p_player_id
  ),
  latest_points as (
    select distinct on(fpp.player_id,fpp.game_id)
      fpp.player_id,fpp.game_id,fpp.actual_points::numeric as actual_points,g.starts_at,g.home_team,g.away_team
    from fantasy_player_points fpp join fantasy_games g on g.id=fpp.game_id
    where fpp.player_id=p_player_id and g.season=p_season
    order by fpp.player_id,fpp.game_id,fpp.calculated_at desc,fpp.id desc
  ),
  season_form as (
    select lp.player_id,avg(lp.actual_points)::numeric as season_ppg from latest_points lp group by lp.player_id
  ),
  ranked_form as (
    select lp.*,row_number() over(partition by lp.player_id order by lp.starts_at desc) as rn from latest_points lp
  ),
  recent_form as (
    select rf.player_id,avg(rf.actual_points)::numeric as form_ppg from ranked_form rf where rf.rn<=5 group by rf.player_id
  ),
  venue_splits as (
    select tp.id as player_id,
      avg(lp.actual_points) filter(where fantasy_team_key(lp.home_team)=fantasy_team_key(tp.team))::numeric as home_ppg,
      avg(lp.actual_points) filter(where fantasy_team_key(lp.away_team)=fantasy_team_key(tp.team))::numeric as away_ppg
    from target_player tp left join latest_points lp on lp.player_id=tp.id group by tp.id
  ),
  upcoming_ranked as (
    select tp.id as player_id,tp.position as player_position,g.id as game_id,g.starts_at,
      case when fantasy_team_key(g.home_team)=fantasy_team_key(tp.team) then g.away_team else g.home_team end as opponent,
      (fantasy_team_key(g.home_team)=fantasy_team_key(tp.team)) as is_home,
      row_number() over(order by g.starts_at,g.id)::integer as fixture_no
    from target_player tp
    join fantasy_games g on fantasy_team_key(g.home_team)=fantasy_team_key(tp.team) or fantasy_team_key(g.away_team)=fantasy_team_key(tp.team)
    where g.season=p_season and g.starts_at>now() and coalesce(g.status,'scheduled') not in('finished','cancelled')
  ),
  fixture_components as (
    select ur.player_id,ur.game_id,ur.fixture_no,ur.starts_at,ur.opponent,ur.is_home,
      coalesce(sf.season_ppg,0)::numeric as season_ppg,coalesce(rf.form_ppg,sf.season_ppg,0)::numeric as form_ppg,
      coalesce(case when ur.is_home then vs.home_ppg else vs.away_ppg end,sf.season_ppg,0)::numeric as venue_ppg,
      fantasy_xfp_opponent_factor(ur.opponent,ur.player_position,p_season)::numeric as opponent_factor
    from upcoming_ranked ur
    left join season_form sf on sf.player_id=ur.player_id
    left join recent_form rf on rf.player_id=ur.player_id
    left join venue_splits vs on vs.player_id=ur.player_id
    where ur.fixture_no<=3
  )
  select fc.player_id,fc.game_id,fc.fixture_no,fc.starts_at,fc.opponent,fc.is_home,
    round(fc.season_ppg,2),round(fc.form_ppg,2),round(fc.venue_ppg,2),round(fc.opponent_factor,3),
    round(v_season_weight*fc.season_ppg + v_form_weight*fc.form_ppg + v_venue_weight*fc.venue_ppg
      + v_opponent_weight*(fc.season_ppg*fc.opponent_factor),2) as fixture_xfp
  from fixture_components fc order by fc.fixture_no;
end;
$$;

revoke all on function fantasy_xfp_preseason_factor(text) from public;
revoke all on function fantasy_xfp_opponent_factor(text,text,text) from public;
revoke all on function get_fantasy_xfp_admin_v1(text) from public;
revoke all on function get_fantasy_xfp_player_fixtures_admin_v1(uuid,text) from public;
grant execute on function get_fantasy_xfp_admin_v1(text) to authenticated;
grant execute on function get_fantasy_xfp_player_fixtures_admin_v1(uuid,text) to authenticated;

comment on function fantasy_xfp_opponent_factor(text,text,text) is
  'Dynamic xFP fixture difficulty: preseason strength anchor blended into 2026/27 live GF/GA over first 12 games; position-aware for goalies vs skaters.';
