-- Stang Inn XI – MP-07.6F
-- Captain Boost scoring integration.
-- Only change in this step: if snapshot.captain_multiplier_override is set
-- (currently 2.50 for captain_boost), the captain uses that immutable value.
-- Line Boost and Transfer Boost are NOT implemented here.

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
  v_default_captain_multiplier numeric(5,2):=2.00;
  v_effective_captain_multiplier numeric(5,2):=2.00;
  v_vice_multiplier numeric(5,2):=1.50;
  v_vice_enabled boolean:=true;
  v_raw numeric(12,2);
  v_games integer;
  v_played boolean;
  v_line_multiplier numeric(5,2);
  v_role_multiplier numeric(5,2);
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
  if not found then raise exception 'Fantasy round not found'; end if;

  select
    coalesce(sr.captain_multiplier,2.00),
    coalesce(sr.vice_captain_multiplier,1.50),
    coalesce(sr.vice_captain_enabled,true)
  into v_default_captain_multiplier,v_vice_multiplier,v_vice_enabled
  from fantasy_season_rules sr
  where sr.season=v_round.season;

  if not found then
    v_default_captain_multiplier:=2.00;
    v_vice_multiplier:=1.50;
    v_vice_enabled:=true;
  end if;

  for v_snapshot in
    select s.*
    from fantasy_team_round_snapshots s
    where s.round_id=v_round.id
    order by s.captured_at,s.id
  loop
    -- Snapshot is the historical rule source. Captain Boost therefore remains
    -- reproducible even if live booster state later changes.
    v_effective_captain_multiplier :=
      coalesce(v_snapshot.captain_multiplier_override,v_default_captain_multiplier);

    insert into fantasy_team_round_points(
      snapshot_id,round_id,team_id,user_id,season,
      base_points,captain_bonus,vice_captain_bonus,total_points,
      calculation_version,calculated_at
    ) values(
      v_snapshot.id,v_round.id,v_snapshot.team_id,v_snapshot.user_id,v_round.season,
      0,0,0,0,'team-v4-captain-boost-snapshot',now()
    )
    on conflict(snapshot_id) do update set
      base_points=0,
      captain_bonus=0,
      vice_captain_bonus=0,
      total_points=0,
      calculation_version='team-v4-captain-boost-snapshot',
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
      -- All games belonging to the fantasy round are summed first. This makes
      -- Double Gameweeks intentional: Captain Boost applies to the captain's
      -- combined round points, exactly like ordinary captain scoring already did.
      with latest_points as (
        select distinct on(fpp.player_id,fpp.game_id)
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

      -- Line scoring remains authoritative v0.60 behaviour in this step:
      -- line 1 = 1.00, line 2 = 0.50. Rekkeboost comes in MP-07.6G.
      v_line_multiplier:=fantasy_line_multiplier(v_sp.line_no);
      v_role_multiplier:=1.00;

      if v_sp.is_captain and v_played then
        v_role_multiplier:=v_effective_captain_multiplier;
      elsif v_sp.is_vice_captain and v_vice_enabled and v_played then
        v_role_multiplier:=v_vice_multiplier;
      end if;

      v_line_points:=round(v_raw*v_line_multiplier,2);
      v_bonus:=round(v_line_points*(v_role_multiplier-1.00),2);
      v_player_total:=v_line_points+v_bonus;

      insert into fantasy_team_round_player_points(
        team_round_points_id,snapshot_id,round_id,team_id,
        player_id,player_name,position,team,
        is_captain,is_vice_captain,played,games_played,
        raw_points,line_no,line_multiplier,multiplier,
        bonus_points,total_points,calculated_at
      ) values(
        v_team_points_id,v_snapshot.id,v_round.id,v_snapshot.team_id,
        v_sp.player_id,v_sp.player_name,v_sp.position,v_sp.team,
        v_sp.is_captain,v_sp.is_vice_captain,v_played,v_games,
        v_raw,v_sp.line_no,v_line_multiplier,v_role_multiplier,
        v_bonus,v_player_total,now()
      );

      v_base:=v_base+v_line_points;
      v_total:=v_total+v_player_total;
      if v_sp.is_captain and v_role_multiplier>1 then
        v_cap_bonus:=v_cap_bonus+v_bonus;
      elsif v_sp.is_vice_captain and v_role_multiplier>1 then
        v_vice_bonus:=v_vice_bonus+v_bonus;
      end if;
      v_players:=v_players+1;
    end loop;

    update fantasy_team_round_points
    set base_points=v_base,
        captain_bonus=v_cap_bonus,
        vice_captain_bonus=v_vice_bonus,
        total_points=v_total,
        calculation_version='team-v4-captain-boost-snapshot',
        calculated_at=now()
    where id=v_team_points_id;

    -- Once an immutable snapshot carrying the booster has actually been scored,
    -- mark the live activation used. Scoring itself never depends on this row.
    if v_snapshot.booster_type='captain_boost' then
      update fantasy_bonus_activations
      set status='used',
          used_at=coalesce(used_at,now()),
          updated_at=now()
      where team_id=v_snapshot.team_id
        and round_id=v_round.id
        and booster_type='captain_boost'
        and status in ('selected','committed');
    end if;

    v_snapshots:=v_snapshots+1;
    v_grand:=v_grand+v_total;
  end loop;

  return query select v_snapshots,v_players,v_grand;
end;
$$;

comment on function public.calculate_fantasy_round_team_points_internal(uuid) is
  'MP-07.6F authoritative scoring: raw round points × normal line weight, then immutable snapshot captain override (2.5 for Captain Boost) or normal C ×2 / VC ×1.5. Multiple games are summed before multipliers.';
