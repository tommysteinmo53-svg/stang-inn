-- Stang Inn Fantasy Hockey – v0.37
-- Admin-only configurable expected Fantasy points (xFP) model for 2026/27.
-- Read-only analysis: scoring, rosters and fixed player prices are never changed.

create table if not exists fantasy_xfp_settings (
  season text primary key,
  season_weight numeric not null default 0.50 check (season_weight between 0 and 1),
  form_weight numeric not null default 0.30 check (form_weight between 0 and 1),
  venue_weight numeric not null default 0.10 check (venue_weight between 0 and 1),
  opponent_weight numeric not null default 0.10 check (opponent_weight between 0 and 1),
  model_version text not null default 'xFP-v1',
  updated_by uuid,
  updated_at timestamptz not null default now(),
  constraint fantasy_xfp_weights_sum_100 check (
    season_weight + form_weight + venue_weight + opponent_weight = 1.00
  )
);

alter table fantasy_xfp_settings enable row level security;

insert into fantasy_xfp_settings(
  season,season_weight,form_weight,venue_weight,opponent_weight,model_version
)
values('2026/27',0.50,0.30,0.10,0.10,'xFP-v1')
on conflict(season) do nothing;

create or replace function get_fantasy_xfp_settings_admin_v1(
  p_season text default '2026/27'
)
returns table(
  season text,
  season_weight numeric,
  form_weight numeric,
  venue_weight numeric,
  opponent_weight numeric,
  model_version text,
  updated_by uuid,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from players p where p.id=auth.uid() and p.admin=true) then
    raise exception 'Admin only';
  end if;

  return query
  select s.season,s.season_weight,s.form_weight,s.venue_weight,s.opponent_weight,
         s.model_version,s.updated_by,s.updated_at
  from fantasy_xfp_settings s
  where s.season=p_season;
end;
$$;

revoke all on function get_fantasy_xfp_settings_admin_v1(text) from public;
grant execute on function get_fantasy_xfp_settings_admin_v1(text) to authenticated;

create or replace function save_fantasy_xfp_settings_admin_v1(
  p_season text,
  p_season_weight numeric,
  p_form_weight numeric,
  p_venue_weight numeric,
  p_opponent_weight numeric
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from players p where p.id=auth.uid() and p.admin=true) then
    raise exception 'Admin only';
  end if;
  if p_season <> '2026/27' then
    raise exception 'Unsupported fantasy season: %',p_season;
  end if;
  if p_season_weight<0 or p_form_weight<0 or p_venue_weight<0 or p_opponent_weight<0 then
    raise exception 'Weights cannot be negative';
  end if;
  if p_season_weight>1 or p_form_weight>1 or p_venue_weight>1 or p_opponent_weight>1 then
    raise exception 'Each weight must be between 0 and 1';
  end if;
  if p_season_weight+p_form_weight+p_venue_weight+p_opponent_weight <> 1.00 then
    raise exception 'xFP weights must total 100%%';
  end if;

  insert into fantasy_xfp_settings(
    season,season_weight,form_weight,venue_weight,opponent_weight,model_version,updated_by,updated_at
  ) values(
    p_season,p_season_weight,p_form_weight,p_venue_weight,p_opponent_weight,'xFP-v1',auth.uid(),now()
  )
  on conflict(season) do update set
    season_weight=excluded.season_weight,
    form_weight=excluded.form_weight,
    venue_weight=excluded.venue_weight,
    opponent_weight=excluded.opponent_weight,
    model_version=excluded.model_version,
    updated_by=excluded.updated_by,
    updated_at=excluded.updated_at;
end;
$$;

revoke all on function save_fantasy_xfp_settings_admin_v1(text,numeric,numeric,numeric,numeric) from public;
grant execute on function save_fantasy_xfp_settings_admin_v1(text,numeric,numeric,numeric,numeric) to authenticated;

create or replace function get_fantasy_xfp_admin_v1(
  p_season text default '2026/27'
)
returns table(
  player_id uuid,
  player_name text,
  team text,
  player_position text,
  price numeric,
  games_scored integer,
  season_ppg numeric,
  form_ppg numeric,
  venue_ppg numeric,
  opponent text,
  next_game_at timestamptz,
  is_home boolean,
  opponent_factor numeric,
  next3_games integer,
  xfp_next_game numeric,
  xfp_next3 numeric,
  value_next3 numeric,
  data_confidence text
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
  if not exists(select 1 from players p where p.id=auth.uid() and p.admin=true) then
    raise exception 'Admin only';
  end if;
  if p_season <> '2026/27' then
    raise exception 'Unsupported fantasy season: %',p_season;
  end if;

  select s.season_weight,s.form_weight,s.venue_weight,s.opponent_weight
  into v_season_weight,v_form_weight,v_venue_weight,v_opponent_weight
  from fantasy_xfp_settings s
  where s.season=p_season;

  if not found then
    raise exception 'xFP settings missing for season %',p_season;
  end if;

  return query
  with latest_points as (
    select distinct on(fpp.player_id,fpp.game_id)
      fpp.player_id,fpp.game_id,fpp.actual_points::numeric as actual_points,
      g.starts_at,g.home_team,g.away_team
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
    select lp.*,row_number() over(partition by lp.player_id order by lp.starts_at desc) as rn
    from latest_points lp
  ),
  recent_form as (
    select rf.player_id,avg(rf.actual_points)::numeric as form_ppg
    from ranked_form rf where rf.rn<=5 group by rf.player_id
  ),
  venue_splits as (
    select fp.id as player_id,
      avg(lp.actual_points) filter(where lp.home_team=fp.team)::numeric as home_ppg,
      avg(lp.actual_points) filter(where lp.away_team=fp.team)::numeric as away_ppg
    from fantasy_players fp
    left join latest_points lp on lp.player_id=fp.id
    group by fp.id
  ),
  team_defense as (
    select club,avg(goals_against)::numeric as goals_against_pg
    from (
      select g.home_team as club,g.away_score::numeric as goals_against
      from fantasy_games g
      where g.season=p_season and g.home_score is not null and g.away_score is not null
      union all
      select g.away_team as club,g.home_score::numeric as goals_against
      from fantasy_games g
      where g.season=p_season and g.home_score is not null and g.away_score is not null
    ) x group by club
  ),
  league_defense as (
    select avg(td.goals_against_pg)::numeric as avg_ga from team_defense td
  ),
  upcoming_ranked as (
    select fp.id as player_id,g.id as game_id,g.starts_at,
      case when g.home_team=fp.team then g.away_team else g.home_team end as opponent,
      (g.home_team=fp.team) as is_home,
      row_number() over(partition by fp.id order by g.starts_at) as rn
    from fantasy_players fp
    join fantasy_games g on(g.home_team=fp.team or g.away_team=fp.team)
    where g.season=p_season and g.starts_at>now()
      and coalesce(g.status,'scheduled') not in('finished','cancelled')
  ),
  next_fixture as (
    select ur.player_id,ur.starts_at,ur.opponent,ur.is_home from upcoming_ranked ur where ur.rn=1
  ),
  next3 as (
    select ur.player_id,count(*)::integer as games from upcoming_ranked ur where ur.rn<=3 group by ur.player_id
  ),
  base as (
    select fp.id as player_id,fp.name as player_name,fp.team,fp.position as player_position,
      sp.price::numeric as price,coalesce(sf.games_scored,0) as games_scored,
      coalesce(sf.season_ppg,0)::numeric as season_ppg,
      coalesce(rf.form_ppg,sf.season_ppg,0)::numeric as form_ppg,
      coalesce(case when nf.is_home then vs.home_ppg else vs.away_ppg end,sf.season_ppg,0)::numeric as venue_ppg,
      nf.opponent,nf.starts_at as next_game_at,nf.is_home,
      case
        when nf.opponent is null then 1::numeric
        when ld.avg_ga is null or ld.avg_ga=0 then 1::numeric
        when td.goals_against_pg is null then 1::numeric
        else greatest(0.80::numeric,least(1.20::numeric,td.goals_against_pg/ld.avg_ga))
      end::numeric as opponent_factor,
      coalesce(n3.games,0) as next3_games
    from fantasy_players fp
    left join fantasy_player_season_prices sp on sp.player_id=fp.id and sp.season=p_season
    left join season_form sf on sf.player_id=fp.id
    left join recent_form rf on rf.player_id=fp.id
    left join venue_splits vs on vs.player_id=fp.id
    left join next_fixture nf on nf.player_id=fp.id
    left join team_defense td on td.club=nf.opponent
    cross join league_defense ld
    left join next3 n3 on n3.player_id=fp.id
    where fp.active=true and fp.on_current_roster=true and sp.price is not null
  ),
  scored as (
    select b.*,
      case when b.next_game_at is null then 0::numeric else
        v_season_weight*b.season_ppg +
        v_form_weight*b.form_ppg +
        v_venue_weight*b.venue_ppg +
        v_opponent_weight*(b.season_ppg*b.opponent_factor)
      end::numeric as raw_xfp
    from base b
  )
  select s.player_id,s.player_name,s.team,s.player_position,s.price,s.games_scored,
    round(s.season_ppg,2),round(s.form_ppg,2),round(s.venue_ppg,2),
    s.opponent,s.next_game_at,s.is_home,round(s.opponent_factor,3),s.next3_games,
    round(s.raw_xfp,2),round(s.raw_xfp*s.next3_games,2),
    case when s.price>0 then round((s.raw_xfp*s.next3_games)/s.price,3) else 0::numeric end,
    case when s.games_scored>=10 then 'high' when s.games_scored>=5 then 'medium' else 'low' end
  from scored s
  order by s.raw_xfp desc,s.player_name;
end;
$$;

revoke all on function get_fantasy_xfp_admin_v1(text) from public;
grant execute on function get_fantasy_xfp_admin_v1(text) to authenticated;

comment on table fantasy_xfp_settings is
  'Admin-only configurable weights for the Stang Inn xFP analysis model.';
comment on function get_fantasy_xfp_admin_v1(text) is
  'Admin-only configurable xFP v1 using season PPG, recent form, venue and opponent defense. Read-only.';
