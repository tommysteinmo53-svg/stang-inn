-- Stang Inn XI – MP-07.6 schema repair
-- Align Bonus Weeks scoring + history read models with the ACTUAL production schema.
-- No historical rows are rewritten by this migration itself.

create or replace function public.calculate_fantasy_round_team_points_internal(p_round_id uuid)
returns table(snapshots_scored integer,player_rows integer,total_points numeric)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_round fantasy_rounds%rowtype;
  v_snapshot record;
  v_sp record;
  v_team_points_id uuid;
  v_captain_multiplier numeric(5,2):=2.00;
  v_vice_multiplier numeric(5,2):=1.50;
  v_vice_enabled boolean:=true;
  v_effective_captain_multiplier numeric(5,2);
  v_effective_line2_multiplier numeric(5,2);
  v_raw numeric(12,2);
  v_games integer;
  v_played boolean;
  v_line_multiplier numeric(5,2);
  v_role_multiplier numeric(5,2);
  v_effective_multiplier numeric(6,3);
  v_line_points numeric(12,2);
  v_bonus numeric(12,2);
  v_player_total numeric(12,2);
  v_base numeric(12,2);
  v_cap_bonus numeric(12,2);
  v_vice_bonus numeric(12,2);
  v_total numeric(12,2);
  v_snapshots integer:=0;
  v_players integer:=0;
  v_grand numeric(14,2):=0;
begin
  select * into v_round
  from fantasy_rounds r
  where r.id=p_round_id;

  if not found then
    raise exception 'Fantasy round not found';
  end if;

  select
    coalesce(sr.captain_multiplier,2.00),
    coalesce(sr.vice_captain_multiplier,1.50),
    coalesce(sr.vice_captain_enabled,true)
  into v_captain_multiplier,v_vice_multiplier,v_vice_enabled
  from fantasy_season_rules sr
  where sr.season=v_round.season;

  if not found then
    v_captain_multiplier:=2.00;
    v_vice_multiplier:=1.50;
    v_vice_enabled:=true;
  end if;

  for v_snapshot in
    select s.*
    from fantasy_team_round_snapshots s
    where s.round_id=v_round.id
    order by s.captured_at,s.id
  loop
    v_effective_captain_multiplier:=coalesce(
      v_snapshot.captain_multiplier_override,
      v_captain_multiplier
    );
    v_effective_line2_multiplier:=coalesce(
      v_snapshot.line2_multiplier_override,
      0.50
    );

    insert into fantasy_team_round_points(
      snapshot_id,
      round_id,
      team_id,
      user_id,
      season,
      base_points,
      captain_bonus,
      vice_captain_bonus,
      total_points,
      calculation_version,
      calculated_at
    ) values(
      v_snapshot.id,
      v_round.id,
      v_snapshot.team_id,
      v_snapshot.user_id,
      v_round.season,
      0,0,0,0,
      'team-v6-bonus-schema-aligned',
      now()
    )
    on conflict(snapshot_id) do update set
      base_points=0,
      captain_bonus=0,
      vice_captain_bonus=0,
      total_points=0,
      calculation_version='team-v6-bonus-schema-aligned',
      calculated_at=now()
    returning id into v_team_points_id;

    delete from fantasy_team_round_player_points
    where team_round_points_id=v_team_points_id;

    v_base:=0;
    v_cap_bonus:=0;
    v_vice_bonus:=0;
    v_total:=0;

    for v_sp in
      select sp.*,fp.name as player_name
      from fantasy_team_round_snapshot_players sp
      join fantasy_players fp on fp.id=sp.player_id
      where sp.snapshot_id=v_snapshot.id
      order by sp.line_no,sp.position,fp.name
    loop
      select
        coalesce(sum(gp.total_points),0),
        count(gp.id)
      into v_raw,v_games
      from fantasy_game_player_points gp
      join fantasy_round_games rg on rg.game_id=gp.game_id
      where rg.round_id=v_round.id
        and gp.player_id=v_sp.player_id;

      v_played:=v_games>0;
      v_line_multiplier:=case
        when v_sp.line_no=2 then v_effective_line2_multiplier
        else 1.00
      end;

      v_line_points:=round(v_raw*v_line_multiplier,2);
      v_role_multiplier:=1.00;

      if v_sp.is_captain then
        v_role_multiplier:=v_effective_captain_multiplier;
      elsif v_sp.is_vice_captain and v_vice_enabled then
        v_role_multiplier:=v_vice_multiplier;
      end if;

      -- The production player-points table stores one combined multiplier,
      -- plus line_no and line_multiplier. Role multiplier can therefore be
      -- derived later as multiplier / line_multiplier.
      v_effective_multiplier:=round(v_line_multiplier*v_role_multiplier,3);
      v_bonus:=round(v_line_points*(v_role_multiplier-1.00),2);
      v_player_total:=round(v_line_points+v_bonus,2);

      insert into fantasy_team_round_player_points(
        team_round_points_id,
        snapshot_id,
        round_id,
        team_id,
        player_id,
        player_name,
        position,
        team,
        is_captain,
        is_vice_captain,
        played,
        games_played,
        raw_points,
        multiplier,
        bonus_points,
        total_points,
        calculated_at,
        line_no,
        line_multiplier
      ) values(
        v_team_points_id,
        v_snapshot.id,
        v_round.id,
        v_snapshot.team_id,
        v_sp.player_id,
        v_sp.player_name,
        v_sp.position,
        v_sp.team,
        v_sp.is_captain,
        v_sp.is_vice_captain,
        v_played,
        v_games,
        v_raw,
        v_effective_multiplier,
        v_bonus,
        v_player_total,
        now(),
        v_sp.line_no,
        v_line_multiplier
      );

      v_base:=v_base+v_line_points;
      if v_sp.is_captain then
        v_cap_bonus:=v_cap_bonus+v_bonus;
      end if;
      if v_sp.is_vice_captain and v_vice_enabled then
        v_vice_bonus:=v_vice_bonus+v_bonus;
      end if;
      v_total:=v_total+v_player_total;
      v_players:=v_players+1;
    end loop;

    update fantasy_team_round_points
    set
      base_points=round(v_base,2),
      captain_bonus=round(v_cap_bonus,2),
      vice_captain_bonus=round(v_vice_bonus,2),
      total_points=round(v_total,2),
      calculated_at=now()
    where id=v_team_points_id;

    v_snapshots:=v_snapshots+1;
    v_grand:=v_grand+v_total;
  end loop;

  return query
  select v_snapshots,v_players,round(v_grand,2);
end;
$$;

revoke all on function public.calculate_fantasy_round_team_points_internal(uuid) from public;
revoke all on function public.calculate_fantasy_round_team_points_internal(uuid) from authenticated;

comment on function public.calculate_fantasy_round_team_points_internal(uuid) is
  'MP-07.6 schema-aligned authoritative scoring. Supports snapshot captain boost and line boost; writes actual production player-point columns.';


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
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_user uuid:=auth.uid();
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  return query
  select
    r.id,
    r.round_no,
    r.name,
    r.deadline_at,
    trp.id,
    trp.team_id,
    s.team_name,
    trp.base_points::numeric,
    trp.captain_bonus::numeric,
    trp.vice_captain_bonus::numeric,
    trp.total_points::numeric,
    trp.calculated_at,
    s.booster_type,
    s.event_type,
    s.event_budget::numeric,
    s.captain_multiplier_override::numeric,
    s.line2_multiplier_override::numeric,
    prp.player_id,
    prp.player_name,
    prp.position,
    prp.team,
    prp.is_captain,
    prp.is_vice_captain,
    prp.played,
    prp.games_played,
    prp.raw_points::numeric,
    coalesce(prp.line_no,1)::integer,
    coalesce(prp.line_multiplier,1.00)::numeric,
    case
      when coalesce(prp.line_multiplier,1.00)=0 then 1.00::numeric
      else round(prp.multiplier/coalesce(prp.line_multiplier,1.00),3)::numeric
    end,
    prp.multiplier::numeric,
    prp.bonus_points::numeric,
    prp.total_points::numeric
  from fantasy_team_round_points trp
  join fantasy_rounds r on r.id=trp.round_id
  join fantasy_team_round_snapshots s on s.id=trp.snapshot_id
  join fantasy_team_round_player_points prp on prp.team_round_points_id=trp.id
  where trp.user_id=v_user
    and trp.season=p_season
    and r.season=p_season
    and r.round_no<9000
    and (p_round_id is null or r.id=p_round_id)
  order by
    r.round_no desc,
    coalesce(prp.line_no,1),
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
      rank() over(
        partition by trp.round_id
        order by trp.total_points desc,trp.calculated_at asc,trp.team_id
      ) as pos
    from fantasy_team_round_points trp
    join fantasy_rounds r on r.id=trp.round_id
    join fantasy_team_round_snapshots s on s.id=trp.snapshot_id
    where trp.season=p_season
      and r.season=p_season
      and r.round_no<9000
  )
  select
    round_id,
    round_no,
    deadline_at,
    total_points::numeric,
    pos::integer,
    booster_type,
    event_type,
    event_budget::numeric
  from scored
  where team_id=p_team_id
  order by round_no desc;
$$;

revoke all on function public.get_fantasy_team_season_history_v2(uuid,text) from public;
grant execute on function public.get_fantasy_team_season_history_v2(uuid,text) to authenticated;

comment on function public.get_my_fantasy_round_details_v2(text,uuid) is
  'MP-07.6K schema-aligned own round history with immutable booster/event metadata.';
comment on function public.get_fantasy_team_season_history_v2(uuid,text) is
  'MP-07.6K schema-aligned competition history with booster/event markers.';
