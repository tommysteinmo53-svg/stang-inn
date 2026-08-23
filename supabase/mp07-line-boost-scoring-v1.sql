-- Stang Inn XI – MP-07.6G
-- Rekkeboost scoring v1.
-- Uses immutable snapshot.line2_multiplier_override from MP-07.6E.
-- Ordinary scoring remains line 1 = 1.00 and line 2 = 0.50.
-- Captain/vice multipliers continue to apply after line weighting.

create or replace function public.calculate_fantasy_round_team_points_internal(p_round_id uuid)
returns table(snapshots_scored integer,player_rows integer,total_points numeric)
language plpgsql security definer set search_path to 'public' as $$
declare
  v_round fantasy_rounds%rowtype; v_snapshot record; v_sp record; v_team_points_id uuid;
  v_captain_multiplier numeric(5,2):=2.00; v_vice_multiplier numeric(5,2):=1.50; v_vice_enabled boolean:=true;
  v_effective_captain_multiplier numeric(5,2); v_effective_line2_multiplier numeric(5,2);
  v_raw numeric(12,2); v_games integer; v_played boolean; v_line_multiplier numeric(5,2); v_role_multiplier numeric(5,2);
  v_line_points numeric(12,2); v_bonus numeric(12,2); v_player_total numeric(12,2); v_base numeric(12,2); v_cap_bonus numeric(12,2); v_vice_bonus numeric(12,2); v_total numeric(12,2);
  v_snapshots integer:=0; v_players integer:=0; v_grand numeric(14,2):=0;
begin
  select * into v_round from fantasy_rounds r where r.id=p_round_id;
  if not found then raise exception 'Fantasy round not found'; end if;

  select coalesce(sr.captain_multiplier,2.00),coalesce(sr.vice_captain_multiplier,1.50),coalesce(sr.vice_captain_enabled,true)
  into v_captain_multiplier,v_vice_multiplier,v_vice_enabled
  from fantasy_season_rules sr where sr.season=v_round.season;
  if not found then v_captain_multiplier:=2.00; v_vice_multiplier:=1.50; v_vice_enabled:=true; end if;

  for v_snapshot in
    select s.* from fantasy_team_round_snapshots s
    where s.round_id=v_round.id order by s.captured_at,s.id
  loop
    -- Immutable snapshot overrides are authoritative for historical re-scoring.
    v_effective_captain_multiplier:=coalesce(v_snapshot.captain_multiplier_override,v_captain_multiplier);
    v_effective_line2_multiplier:=coalesce(v_snapshot.line2_multiplier_override,0.50);

    insert into fantasy_team_round_points(
      snapshot_id,round_id,team_id,user_id,season,base_points,captain_bonus,vice_captain_bonus,total_points,calculation_version,calculated_at
    ) values(
      v_snapshot.id,v_round.id,v_snapshot.team_id,v_snapshot.user_id,v_round.season,0,0,0,0,
      'team-v5-bonus-captain-line-snapshot',now()
    )
    on conflict(snapshot_id) do update set
      base_points=0,captain_bonus=0,vice_captain_bonus=0,total_points=0,
      calculation_version='team-v5-bonus-captain-line-snapshot',calculated_at=now()
    returning id into v_team_points_id;

    delete from fantasy_team_round_player_points where team_round_points_id=v_team_points_id;
    v_base:=0; v_cap_bonus:=0; v_vice_bonus:=0; v_total:=0;

    for v_sp in
      select sp.*,fp.name as player_name
      from fantasy_team_round_snapshot_players sp
      join fantasy_players fp on fp.id=sp.player_id
      where sp.snapshot_id=v_snapshot.id
      order by sp.line_no,sp.position,fp.name
    loop
      -- All game rows in the fantasy round are summed BEFORE line/C/VC multipliers.
      -- This deliberately supports 0, 1 and multiple games (double gameweeks).
      select coalesce(sum(gp.total_points),0),count(gp.id)
      into v_raw,v_games
      from fantasy_game_player_points gp
      join fantasy_round_games rg on rg.game_id=gp.game_id
      where rg.round_id=v_round.id and gp.player_id=v_sp.player_id;

      v_played:=v_games>0;
      v_line_multiplier:=case when v_sp.line_no=2 then v_effective_line2_multiplier else 1.00 end;
      v_line_points:=round(v_raw*v_line_multiplier,2);
      v_role_multiplier:=1.00;

      if v_sp.is_captain then
        v_role_multiplier:=v_effective_captain_multiplier;
      elsif v_sp.is_vice_captain and v_vice_enabled then
        v_role_multiplier:=v_vice_multiplier;
      end if;

      v_bonus:=round(v_line_points*(v_role_multiplier-1.00),2);
      v_player_total:=round(v_line_points+v_bonus,2);

      insert into fantasy_team_round_player_points(
        team_round_points_id,snapshot_player_id,player_id,raw_points,played,line_no,line_multiplier,
        role_multiplier,bonus_points,total_points,game_count
      ) values(
        v_team_points_id,v_sp.id,v_sp.player_id,v_raw,v_played,v_sp.line_no,v_line_multiplier,
        v_role_multiplier,v_bonus,v_player_total,v_games
      );

      v_base:=v_base+v_line_points;
      if v_sp.is_captain then v_cap_bonus:=v_cap_bonus+v_bonus; end if;
      if v_sp.is_vice_captain and v_vice_enabled then v_vice_bonus:=v_vice_bonus+v_bonus; end if;
      v_total:=v_total+v_player_total;
      v_players:=v_players+1;
    end loop;

    update fantasy_team_round_points
    set base_points=round(v_base,2),captain_bonus=round(v_cap_bonus,2),vice_captain_bonus=round(v_vice_bonus,2),
        total_points=round(v_total,2),calculated_at=now()
    where id=v_team_points_id;

    v_snapshots:=v_snapshots+1;
    v_grand:=v_grand+v_total;
  end loop;

  return query select v_snapshots,v_players,round(v_grand,2);
end;
$$;

revoke all on function public.calculate_fantasy_round_team_points_internal(uuid) from public;
revoke all on function public.calculate_fantasy_round_team_points_internal(uuid) from authenticated;

comment on function public.calculate_fantasy_round_team_points_internal(uuid) is
  'MP-07.6G authoritative team scoring: snapshot captain override + snapshot line-2 override. Rekkeboost sets line 2 to 100%; ordinary/event rounds remain 50%. All games in a fantasy round are summed before multipliers.';
