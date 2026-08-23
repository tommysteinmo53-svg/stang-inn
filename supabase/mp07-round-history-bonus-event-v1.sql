-- Stang Inn XI – MP-07.6K
-- Schema-aligned round-history read models for personal boosters + Rik/Fattig Onkel.
-- Presentation only: no scoring, snapshot, transfer or deadline rules are changed.

create or replace function public.get_my_fantasy_round_details_v2(
  p_season text,
  p_round_id uuid default null
) returns table(
  round_id uuid, round_no integer, round_name text, deadline_at timestamptz,
  team_round_points_id uuid, team_id uuid, team_name text,
  base_points numeric, captain_bonus numeric, vice_captain_bonus numeric,
  round_points numeric, calculated_at timestamptz,
  booster_type text, event_type text, event_budget numeric,
  captain_multiplier_override numeric, line2_multiplier_override numeric,
  player_id uuid, player_name text, player_position text, player_team text,
  is_captain boolean, is_vice_captain boolean, played boolean,
  games_played integer, raw_points numeric, line_no integer,
  line_multiplier numeric, role_multiplier numeric, multiplier numeric,
  bonus_points numeric, player_total_points numeric
)
language plpgsql stable security definer set search_path=public
as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  return query
  select
    r.id,r.round_no,r.name,r.deadline_at,trp.id,trp.team_id,s.team_name,
    trp.base_points::numeric,trp.captain_bonus::numeric,trp.vice_captain_bonus::numeric,
    trp.total_points::numeric,trp.calculated_at,
    s.booster_type,s.event_type,s.event_budget::numeric,
    s.captain_multiplier_override::numeric,s.line2_multiplier_override::numeric,
    prp.player_id,prp.player_name,prp.position,prp.team,
    prp.is_captain,prp.is_vice_captain,prp.played,prp.games_played,
    prp.raw_points::numeric,coalesce(prp.line_no,1)::integer,
    coalesce(prp.line_multiplier,1.00)::numeric,
    case when coalesce(prp.line_multiplier,1.00)=0 then 1.00::numeric
         else round(prp.multiplier/coalesce(prp.line_multiplier,1.00),3)::numeric end,
    prp.multiplier::numeric,prp.bonus_points::numeric,prp.total_points::numeric
  from fantasy_team_round_points trp
  join fantasy_rounds r on r.id=trp.round_id
  join fantasy_team_round_snapshots s on s.id=trp.snapshot_id
  join fantasy_team_round_player_points prp on prp.team_round_points_id=trp.id
  where trp.user_id=v_user
    and trp.season=p_season
    and r.season=p_season
    and r.round_no<9000
    and (p_round_id is null or r.id=p_round_id)
  order by r.round_no desc,coalesce(prp.line_no,1),
    case when prp.position='G' then 0 when prp.position='D' then 1 else 2 end,
    prp.player_name;
end;
$$;

revoke all on function public.get_my_fantasy_round_details_v2(text,uuid) from public;
grant execute on function public.get_my_fantasy_round_details_v2(text,uuid) to authenticated;

create or replace function public.get_fantasy_team_season_history_v2(
  p_team_id uuid,
  p_season text
) returns table(
  round_id uuid, round_no integer, deadline_at timestamptz,
  round_points numeric, round_position integer,
  booster_type text, event_type text, event_budget numeric
)
language sql stable security definer set search_path=public
as $$
  with scored as (
    select trp.round_id,r.round_no,r.deadline_at,trp.team_id,trp.total_points,
      s.booster_type,s.event_type,s.event_budget,
      rank() over(partition by trp.round_id order by trp.total_points desc,trp.calculated_at asc,trp.team_id) as pos
    from fantasy_team_round_points trp
    join fantasy_rounds r on r.id=trp.round_id
    join fantasy_team_round_snapshots s on s.id=trp.snapshot_id
    where trp.season=p_season and r.season=p_season and r.round_no<9000
  )
  select round_id,round_no,deadline_at,total_points::numeric,pos::integer,
    booster_type,event_type,event_budget::numeric
  from scored where team_id=p_team_id order by round_no desc;
$$;

revoke all on function public.get_fantasy_team_season_history_v2(uuid,text) from public;
grant execute on function public.get_fantasy_team_season_history_v2(uuid,text) to authenticated;

comment on function public.get_my_fantasy_round_details_v2(text,uuid) is
  'MP-07.6K schema-aligned own round history with immutable booster/event metadata.';
comment on function public.get_fantasy_team_season_history_v2(uuid,text) is
  'MP-07.6K schema-aligned competition history with booster/event markers.';
