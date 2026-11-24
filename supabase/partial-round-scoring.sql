-- Allow provisional scores from completed, ready games; retain frozen rosters.
CREATE OR REPLACE FUNCTION public.calculate_fantasy_round_team_points_internal(p_round_id uuid)
 RETURNS TABLE(snapshots_scored integer, player_rows integer, total_points numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      join fantasy_games fg on fg.id=gp.game_id
      where rg.round_id=v_round.id
        and fg.status='finished'
        and fantasy_game_points_ready(fg.id)
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
$function$
;

CREATE OR REPLACE FUNCTION public.process_fantasy_rounds_automation(p_season text, p_include_test_rounds boolean DEFAULT false)
 RETURNS TABLE(due_rounds integer, teams_checked integer, snapshots_created integer, already_frozen integer, snapshot_errors integer, ready_rounds integer, scored_rounds integer, scored_snapshots integer, skipped_unfinished integer, skipped_points_not_ready integer, status_updates integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user uuid := auth.uid();
  v_role text := coalesce(auth.role(),'');
  v_round record;
  v_team record;
  v_score record;
  v_before uuid;
  v_due integer := 0;
  v_checked integer := 0;
  v_created integer := 0;
  v_existing integer := 0;
  v_errors integer := 0;
  v_ready integer := 0;
  v_scored_rounds integer := 0;
  v_scored_snapshots integer := 0;
  v_unfinished integer := 0;
  v_points_not_ready integer := 0;
  v_status_updates integer := 0;
  v_game_count integer;
  v_finished_count integer;
  v_points_game_count integer;
  v_needs_scoring boolean;
  v_new_status text;
begin
  if v_role <> 'service_role' then
    if v_user is null then raise exception 'Not authenticated'; end if;
    if not exists(select 1 from players p where p.id=v_user and coalesce(p.admin,false)) then
      raise exception 'Admin access required';
    end if;
  end if;

  if p_season is null or btrim(p_season)='' then
    raise exception 'Season is required';
  end if;

  select count(*)::integer into v_due
  from fantasy_rounds r
  where r.season=p_season
    and r.deadline_at<=now()
    and (p_include_test_rounds or r.round_no<9000);

  for v_round in
    select r.id,r.round_no,r.deadline_at,r.status
    from fantasy_rounds r
    where r.season=p_season
      and (p_include_test_rounds or r.round_no<9000)
    order by r.deadline_at,r.round_no
  loop
    select
      count(*)::integer,
      count(*) filter(where g.status='finished')::integer,
      count(*) filter(where g.status='finished' and fantasy_game_points_ready(g.id))::integer
    into v_game_count,v_finished_count,v_points_game_count
    from fantasy_games g
    where g.fantasy_round_id=v_round.id;

    v_new_status := case
      when now()<v_round.deadline_at then 'open'
      when v_game_count>0 and v_finished_count=v_game_count then 'finished'
      else 'locked'
    end;

    if v_round.status is distinct from v_new_status then
      update fantasy_rounds
      set status=v_new_status,updated_at=now()
      where id=v_round.id;
      v_status_updates:=v_status_updates+1;
    end if;

    if v_round.deadline_at>now() then
      continue;
    end if;

    for v_team in
      select t.id from fantasy_user_teams t
      where t.season=p_season
        and t.created_at <= v_round.deadline_at
        and (
          not exists (
            select 1 from fantasy_event_weeks ew
            where ew.round_id=v_round.id
              and ew.season=p_season
              and ew.event_type in ('rich_uncle','poor_uncle')
          )
          or exists (
            select 1 from fantasy_event_weeks ew
            join fantasy_event_teams et on et.event_week_id=ew.id
            where ew.round_id=v_round.id
              and ew.season=p_season
              and ew.event_type in ('rich_uncle','poor_uncle')
              and et.permanent_team_id=t.id
              and et.user_id=t.user_id
          )
        )
    loop
      v_checked:=v_checked+1;
      select s.id into v_before
      from fantasy_team_round_snapshots s
      where s.round_id=v_round.id and s.team_id=v_team.id;

      if v_before is not null then
        v_existing:=v_existing+1;
      else
        begin
          perform freeze_fantasy_team_for_round_internal(v_team.id,v_round.id,now());
          v_created:=v_created+1;
        exception when others then
          v_errors:=v_errors+1;
        end;
      end if;
    end loop;

    if v_game_count=0 or v_finished_count=0 then
      v_unfinished:=v_unfinished+1;
      continue;
    end if;

    if v_points_game_count<>v_finished_count then
      v_points_not_ready:=v_points_not_ready+1;
      continue;
    end if;

    v_ready:=v_ready+1;

    select
      exists(
        select 1
        from fantasy_team_round_snapshots s
        left join fantasy_team_round_points trp on trp.snapshot_id=s.id
        where s.round_id=v_round.id and trp.id is null
      )
      or exists(
        select 1
        from fantasy_player_points fpp
        join fantasy_games g on g.id=fpp.game_id
        where g.fantasy_round_id=v_round.id
          and g.status='finished'
          and fpp.calculated_at > coalesce(
            (select min(trp.calculated_at)
             from fantasy_team_round_points trp
             where trp.round_id=v_round.id),
            '-infinity'::timestamptz
          )
      )
    into v_needs_scoring;

    if not v_needs_scoring then
      continue;
    end if;

    select * into v_score
    from calculate_fantasy_round_team_points_internal(v_round.id);

    v_scored_rounds:=v_scored_rounds+1;
    v_scored_snapshots:=v_scored_snapshots+coalesce(v_score.snapshots_scored,0);
  end loop;

  return query select
    v_due,v_checked,v_created,v_existing,v_errors,v_ready,
    v_scored_rounds,v_scored_snapshots,v_unfinished,v_points_not_ready,v_status_updates;
end;
$function$
;