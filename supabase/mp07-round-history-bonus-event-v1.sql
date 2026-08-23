-- Stang Inn XI – MP-07.6K
-- Round-history read models for personal boosters + Rik/Fattig Onkel.
-- Presentation only: no scoring, snapshot, transfer or deadline rules are changed.

create or replace function public.get_my_fantasy_round_details_v2(
  p_season text,
  p_round_id uuid default null
) returns table(
  round_id uuid,
  round_no integer,
  round_name text,
  deadline_at timestamptz,
  team_round_points_id uuid,
  team_id uuid,
  team_name text,
  base_points numeric,
  captain_bonus numeric,
  vice_captain_bonus numeric,
  round_points numeric,
  calculated_at timestamptz,
  booster_type text,
  event_type text,
  event_budget numeric,
  captain_multiplier_override numeric,
  line2_multiplier_override numeric,
  player_id uuid,
  player_name text,
  player_position text,
  player_team text,
  is_captain boolean,
  is_vice_captain boolean,
  played boolean,
  games_played integer,
  raw_points numeric,
  line_no integer,
  line_multiplier numeric,
  role_multiplier numeric,
  multiplier numeric,
  bonus_points numeric,
  player_total_points numeric
)
language sql
stable
security definer
set search_path=public
as $$
  select
    r.id,
    r.round_no,
    r.name,
    r.deadline_at,
    trp.id,
    trp.team_id,
    t.name,
    trp.base_points,
    trp.captain_bonus,
    trp.vice_captain_bonus,
    trp.total_points,
    trp.calculated_at,
    s.booster_type,
    s.event_type,
    s.event_budget,
    s.captain_multiplier_override,
    s.line2_multiplier_override,
    pp.player_id,
    fp.name,
    sp.position,
    fp.team,
    sp.is_captain,
    sp.is_vice_captain,
    pp.played,
    pp.game_count,
    pp.raw_points,
    pp.line_no::integer,
    pp.line_multiplier,
    pp.role_multiplier,
    round(pp.line_multiplier * pp.role_multiplier,2) as multiplier,
    pp.bonus_points,
    pp.total_points
  from fantasy_team_round_points trp
  join fantasy_team_round_snapshots s on s.id=trp.snapshot_id
  join fantasy_rounds r on r.id=trp.round_id
  join fantasy_user_teams t on t.id=trp.team_id
  join fantasy_team_round_player_points pp on pp.team_round_points_id=trp.id
  join fantasy_team_round_snapshot_players sp on sp.id=pp.snapshot_player_id
  join fantasy_players fp on fp.id=pp.player_id
  where trp.user_id=auth.uid()
    and trp.season=p_season
    and (p_round_id is null or trp.round_id=p_round_id)
  order by r.round_no desc, pp.line_no, sp.position, fp.name;
$$;

revoke all on function public.get_my_fantasy_round_details_v2(text,uuid) from public;
grant execute on function public.get_my_fantasy_round_details_v2(text,uuid) to authenticated;

create or replace function public.get_fantasy_team_season_history_v2(
  p_team_id uuid,
  p_season text
) returns table(
  round_id uuid,
  round_no integer,
  deadline_at timestamptz,
  round_points numeric,
  round_position integer,
  booster_type text,
  event_type text,
  event_budget numeric
)
language sql
stable
security definer
set search_path=public
as $$
  with scored as (
    select
      trp.round_id,
      r.round_no,
      r.deadline_at,
      trp.team_id,
      trp.total_points,
      s.booster_type,
      s.event_type,
      s.event_budget,
      rank() over(partition by trp.round_id order by trp.total_points desc, trp.calculated_at asc, trp.team_id) as pos
    from fantasy_team_round_points trp
    join fantasy_rounds r on r.id=trp.round_id
    join fantasy_team_round_snapshots s on s.id=trp.snapshot_id
    where trp.season=p_season
  )
  select round_id,round_no,deadline_at,total_points,pos::integer,booster_type,event_type,event_budget
  from scored
  where team_id=p_team_id
  order by round_no desc;
$$;

revoke all on function public.get_fantasy_team_season_history_v2(uuid,text) from public;
grant execute on function public.get_fantasy_team_season_history_v2(uuid,text) to authenticated;

comment on function public.get_my_fantasy_round_details_v2(text,uuid) is
  'MP-07.6K: own scored round/player details plus immutable snapshot booster/event metadata and effective line/role multipliers.';
comment on function public.get_fantasy_team_season_history_v2(uuid,text) is
  'MP-07.6K: scored competition history with immutable booster/event markers for transparent leaderboard history.';
