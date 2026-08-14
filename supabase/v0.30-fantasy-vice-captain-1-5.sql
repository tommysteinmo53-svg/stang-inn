-- Stang Inn Fantasy Hockey – v0.30
-- Captain = x2.0 and vice-captain = x1.5 whenever they play.
-- Vice-captain is no longer only a captain fallback.

alter table fantasy_season_rules
  add column if not exists vice_captain_multiplier numeric(5,2) not null default 1.50
    check (vice_captain_multiplier >= 1.00);

update fantasy_season_rules
set vice_captain_multiplier = 1.50,
    vice_captain_enabled = true
where season = '2026/27';

create or replace function calculate_fantasy_round_team_points(
  p_round_id uuid
) returns table(
  snapshots_scored integer,
  player_rows integer,
  total_points numeric
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_round fantasy_rounds%rowtype;
  v_snapshot record;
  v_sp record;
  v_team_points_id uuid;
  v_captain_multiplier numeric(5,2) := 2.00;
  v_vice_multiplier numeric(5,2) := 1.50;
  v_vice_enabled boolean := true;
  v_raw numeric(12,2);
  v_games integer;
  v_played boolean;
  v_effective_multiplier numeric(5,2);
  v_bonus numeric(12,2);
  v_total numeric(12,2);
  v_base numeric(12,2);
  v_cap_bonus numeric(12,2);
  v_vice_bonus numeric(12,2);
  v_snapshots integer := 0;
  v_players integer := 0;
  v_grand numeric(14,2) := 0;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from players p where p.id=v_user and coalesce(p.admin,false)) then
    raise exception 'Admin access required';
  end if;

  select * into v_round from fantasy_rounds r where r.id=p_round_id;
  if not found then raise exception 'Fantasy round not found'; end if;

  select
    coalesce(sr.captain_multiplier,2.00),
    coalesce(sr.vice_captain_multiplier,1.50),
    coalesce(sr.vice_captain_enabled,true)
  into v_captain_multiplier,v_vice_multiplier,v_vice_enabled
  from fantasy_season_rules sr
  where sr.season=v_round.season;

  if not found then
    v_captain_multiplier := 2.00;
    v_vice_multiplier := 1.50;
    v_vice_enabled := true;
  end if;

  for v_snapshot in
    select s.*
    from fantasy_team_round_snapshots s
    where s.round_id=v_round.id
    order by s.captured_at,s.id
  loop
    insert into fantasy_team_round_points(
      snapshot_id,round_id,team_id,user_id,season,
      base_points,captain_bonus,vice_captain_bonus,total_points,
      calculation_version,calculated_at
    ) values(
      v_snapshot.id,v_round.id,v_snapshot.team_id,v_snapshot.user_id,v_round.season,
      0,0,0,0,'team-v2-c2-vc1.5',now()
    )
    on conflict(snapshot_id) do update set
      base_points=0,
      captain_bonus=0,
      vice_captain_bonus=0,
      total_points=0,
      calculation_version='team-v2-c2-vc1.5',
      calculated_at=now()
    returning id into v_team_points_id;

    delete from fantasy_team_round_player_points
    where team_round_points_id=v_team_points_id;

    v_base := 0;
    v_cap_bonus := 0;
    v_vice_bonus := 0;
    v_total := 0;

    for v_sp in
      select sp.*,fp.name as player_name
      from fantasy_team_round_snapshot_players sp
      join fantasy_players fp on fp.id=sp.player_id
      where sp.snapshot_id=v_snapshot.id
      order by sp.position,fp.name
    loop
      with latest_points as (
        select distinct on (fpp.player_id,fpp.game_id)
          fpp.player_id,fpp.game_id,fpp.actual_points
        from fantasy_player_points fpp
        join fantasy_games g on g.id=fpp.game_id
        where fpp.player_id=v_sp.player_id
          and g.fantasy_round_id=v_round.id
        order by fpp.player_id,fpp.game_id,fpp.calculated_at desc,fpp.id desc
      )
      select coalesce(sum(lp.actual_points),0)::numeric,
             count(lp.game_id)::integer
      into v_raw,v_games
      from latest_points lp;

      select exists(
        select 1
        from fantasy_player_game_stats pgs
        join fantasy_games g on g.id=pgs.game_id
        where pgs.player_id=v_sp.player_id
          and g.fantasy_round_id=v_round.id
      ) into v_played;

      v_effective_multiplier := 1.00;
      if v_sp.is_captain and v_played then
        v_effective_multiplier := v_captain_multiplier;
      elsif v_sp.is_vice_captain and v_vice_enabled and v_played then
        v_effective_multiplier := v_vice_multiplier;
      end if;

      v_bonus := round(v_raw*(v_effective_multiplier-1.00),2);

      insert into fantasy_team_round_player_points(
        team_round_points_id,snapshot_id,round_id,team_id,
        player_id,player_name,position,team,
        is_captain,is_vice_captain,played,games_played,
        raw_points,multiplier,bonus_points,total_points,calculated_at
      ) values(
        v_team_points_id,v_snapshot.id,v_round.id,v_snapshot.team_id,
        v_sp.player_id,v_sp.player_name,v_sp.position,v_sp.team,
        v_sp.is_captain,v_sp.is_vice_captain,v_played,v_games,
        v_raw,v_effective_multiplier,v_bonus,v_raw+v_bonus,now()
      );

      v_base := v_base+v_raw;
      v_total := v_total+v_raw+v_bonus;
      if v_sp.is_captain and v_effective_multiplier>1 then
        v_cap_bonus := v_cap_bonus+v_bonus;
      elsif v_sp.is_vice_captain and v_effective_multiplier>1 then
        v_vice_bonus := v_vice_bonus+v_bonus;
      end if;
      v_players := v_players+1;
    end loop;

    update fantasy_team_round_points
    set base_points=v_base,
        captain_bonus=v_cap_bonus,
        vice_captain_bonus=v_vice_bonus,
        total_points=v_total,
        calculated_at=now()
    where id=v_team_points_id;

    v_snapshots := v_snapshots+1;
    v_grand := v_grand+v_total;
  end loop;

  return query select v_snapshots,v_players,v_grand;
end;
$$;

revoke all on function calculate_fantasy_round_team_points(uuid) from public;
grant execute on function calculate_fantasy_round_team_points(uuid) to authenticated;
