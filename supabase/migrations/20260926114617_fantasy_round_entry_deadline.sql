-- Prevent retroactive participation; preserve valid rounds and existing permissions.
CREATE OR REPLACE FUNCTION public.freeze_due_fantasy_rounds(p_season text)
 RETURNS TABLE(due_rounds integer, teams_checked integer, snapshots_created integer, already_frozen integer, errors integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user uuid := auth.uid();

  v_round record;
  v_team record;

  v_due integer := 0;
  v_checked integer := 0;

  v_created integer := 0;
  v_existing integer := 0;

  v_errors integer := 0;

  v_before uuid;
begin

  if v_user is null then
    raise exception 'Not authenticated';
  end if;


  if not exists(
    select 1
    from players p
    where p.id=v_user
      and coalesce(p.admin,false)
  ) then
    raise exception 'Admin access required';
  end if;


  select count(*)::integer
  into v_due
  from fantasy_rounds r
  where r.season=p_season
    and r.deadline_at<=now();


  for v_round in

    select
      id,
      deadline_at

    from fantasy_rounds

    where season=p_season
      and deadline_at<=now()

    order by deadline_at

  loop


    for v_team in

      select id
      from fantasy_user_teams
      where season=p_season and created_at <= v_round.deadline_at

    loop

      v_checked := v_checked+1;


      v_before := null;

      select id
      into v_before
      from fantasy_team_round_snapshots
      where round_id=v_round.id
        and team_id=v_team.id;


      if v_before is not null then

        v_existing := v_existing+1;

      else

        begin

          perform freeze_fantasy_team_for_round_internal(
            v_team.id,
            v_round.id,
            greatest(
              v_round.deadline_at,
              now()
            )
          );

          v_created := v_created+1;


        exception
          when others then

            v_errors := v_errors+1;

        end;

      end if;

    end loop;

  end loop;


  return query

  select
    v_due,
    v_checked,
    v_created,
    v_existing,
    v_errors;

end;
$function$;


CREATE OR REPLACE FUNCTION public.freeze_fantasy_team_for_round_internal(p_team_id uuid, p_round_id uuid, p_captured_at timestamp with time zone DEFAULT now())
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_round fantasy_rounds%rowtype; v_team fantasy_user_teams%rowtype; v_snapshot uuid;
  v_count integer; v_f integer; v_d integer; v_g integer; v_captains integer; v_vice integer; v_value numeric;
  v_l1 integer; v_l1f integer; v_l1d integer; v_l1g integer; v_l2 integer; v_l2f integer; v_l2d integer; v_l2g integer;
  v_event fantasy_event_weeks%rowtype; v_event_team fantasy_event_teams%rowtype; v_booster fantasy_bonus_activations%rowtype;
  v_cap_override numeric(5,2); v_line2_override numeric(5,2);
begin
  select * into v_round from fantasy_rounds where id=p_round_id;
  if not found then raise exception 'Fantasy round not found'; end if;
  select * into v_team from fantasy_user_teams where id=p_team_id;
  if not found then raise exception 'Fantasy team not found'; end if;
  if v_team.created_at > v_round.deadline_at then raise exception 'Team was created after the round deadline'; end if;
  if v_team.season is distinct from v_round.season then raise exception 'Team season % does not match round season %',v_team.season,v_round.season; end if;
  select s.id into v_snapshot from fantasy_team_round_snapshots s where s.round_id=v_round.id and s.team_id=v_team.id;
  if v_snapshot is not null then return v_snapshot; end if;

  select * into v_event from fantasy_event_weeks ew where ew.season=v_round.season and ew.round_id=v_round.id;

  if v_event.id is not null and v_event.event_type in ('rich_uncle','poor_uncle') then
    if exists(select 1 from fantasy_bonus_activations a where a.team_id=v_team.id and a.round_id=v_round.id and a.status in ('selected','committed','used')) then raise exception 'Personal boosters cannot coexist with an Event Week'; end if;
    select * into v_event_team from fantasy_event_teams et where et.event_week_id=v_event.id and et.permanent_team_id=v_team.id and et.user_id=v_team.user_id;
    if not found then raise exception 'Event team is missing for %',v_event.event_type; end if;
    if v_event_team.season is distinct from v_round.season then raise exception 'Event team season mismatch'; end if;
    if v_event_team.budget is distinct from v_event.event_budget then raise exception 'Event team budget metadata mismatch'; end if;
    select count(*),count(*) filter(where fp.position in ('C','W')),count(*) filter(where fp.position='D'),count(*) filter(where fp.position='G'),count(*) filter(where ep.is_captain),count(*) filter(where ep.is_vice_captain),coalesce(sum(ep.purchase_price),0),count(*) filter(where ep.line_no=1),count(*) filter(where ep.line_no=1 and fp.position in ('C','W')),count(*) filter(where ep.line_no=1 and fp.position='D'),count(*) filter(where ep.line_no=1 and fp.position='G'),count(*) filter(where ep.line_no=2),count(*) filter(where ep.line_no=2 and fp.position in ('C','W')),count(*) filter(where ep.line_no=2 and fp.position='D'),count(*) filter(where ep.line_no=2 and fp.position='G')
      into v_count,v_f,v_d,v_g,v_captains,v_vice,v_value,v_l1,v_l1f,v_l1d,v_l1g,v_l2,v_l2f,v_l2d,v_l2g
      from fantasy_event_team_players ep join fantasy_players fp on fp.id=ep.player_id where ep.event_team_id=v_event_team.id;
    if v_count<>12 or v_f<>6 or v_d<>4 or v_g<>2 then raise exception 'Cannot freeze invalid event roster: expected 6F/4D/2G, got % players (%F/%D/%G)',v_count,v_f,v_d,v_g; end if;
    if v_captains<>1 or v_vice<>1 then raise exception 'Cannot freeze event team without exactly one captain and one vice-captain'; end if;
    if v_l1<>6 or v_l1f<>3 or v_l1d<>2 or v_l1g<>1 or v_l2<>6 or v_l2f<>3 or v_l2d<>2 or v_l2g<>1 then raise exception 'Cannot freeze invalid event lineup: each line must contain 1G/2D/3F'; end if;
    if v_value>v_event.event_budget then raise exception 'Event budget exceeded at snapshot: %m > %m',v_value,v_event.event_budget; end if;
    insert into fantasy_team_round_snapshots(round_id,team_id,user_id,season,team_name,squad_value,captured_at,booster_type,event_type,event_budget,source_event_team_id,captain_multiplier_override,line2_multiplier_override)
      values(v_round.id,v_team.id,v_team.user_id,v_round.season,v_team.name,v_value,p_captured_at,null,v_event.event_type,v_event.event_budget,v_event_team.id,null,null)
      on conflict(round_id,team_id) do nothing returning id into v_snapshot;
    if v_snapshot is null then select id into v_snapshot from fantasy_team_round_snapshots where round_id=v_round.id and team_id=v_team.id; return v_snapshot; end if;
    insert into fantasy_team_round_snapshot_players(snapshot_id,player_id,position,team,price,is_captain,is_vice_captain,line_no)
      select v_snapshot,fp.id,fp.position,fp.team,ep.purchase_price,ep.is_captain,ep.is_vice_captain,ep.line_no from fantasy_event_team_players ep join fantasy_players fp on fp.id=ep.player_id where ep.event_team_id=v_event_team.id;
    return v_snapshot;
  end if;

  select count(*),count(*) filter(where fp.position in ('C','W')),count(*) filter(where fp.position='D'),count(*) filter(where fp.position='G'),count(*) filter(where tp.is_captain),count(*) filter(where tp.is_vice_captain),coalesce(sum(tp.purchase_price),0),count(*) filter(where tp.line_no=1),count(*) filter(where tp.line_no=1 and fp.position in ('C','W')),count(*) filter(where tp.line_no=1 and fp.position='D'),count(*) filter(where tp.line_no=1 and fp.position='G'),count(*) filter(where tp.line_no=2),count(*) filter(where tp.line_no=2 and fp.position in ('C','W')),count(*) filter(where tp.line_no=2 and fp.position='D'),count(*) filter(where tp.line_no=2 and fp.position='G')
    into v_count,v_f,v_d,v_g,v_captains,v_vice,v_value,v_l1,v_l1f,v_l1d,v_l1g,v_l2,v_l2f,v_l2d,v_l2g
    from fantasy_user_team_players tp join fantasy_players fp on fp.id=tp.player_id where tp.team_id=v_team.id;
  if v_count<>12 or v_f<>6 or v_d<>4 or v_g<>2 then raise exception 'Cannot freeze invalid roster: expected 6F/4D/2G, got % players (%F/%D/%G)',v_count,v_f,v_d,v_g; end if;
  if v_captains<>1 or v_vice<>1 then raise exception 'Cannot freeze team without exactly one captain and one vice-captain'; end if;
  if v_l1<>6 or v_l1f<>3 or v_l1d<>2 or v_l1g<>1 or v_l2<>6 or v_l2f<>3 or v_l2d<>2 or v_l2g<>1 then raise exception 'Cannot freeze invalid lineup: each line must contain 1G/2D/3F'; end if;

  if v_event.id is not null and v_event.event_type='christmas_party' then
    if exists(select 1 from fantasy_bonus_activations a where a.team_id=v_team.id and a.round_id=v_round.id and a.status in ('selected','committed','used')) then raise exception 'Personal boosters cannot coexist with an Event Week'; end if;
    v_cap_override:=null; v_line2_override:=1.00;
  else
    select * into v_booster from fantasy_bonus_activations a where a.team_id=v_team.id and a.round_id=v_round.id and a.status in ('selected','committed','used') order by a.updated_at desc limit 1;
    v_cap_override:=case when v_booster.id is not null and v_booster.booster_type='captain_boost' then 2.50 else null end;
    v_line2_override:=case when v_booster.id is not null and v_booster.booster_type='line_boost' then 1.00 else null end;
  end if;

  insert into fantasy_team_round_snapshots(round_id,team_id,user_id,season,team_name,squad_value,captured_at,booster_type,event_type,event_budget,source_event_team_id,captain_multiplier_override,line2_multiplier_override)
    values(v_round.id,v_team.id,v_team.user_id,v_round.season,v_team.name,v_value,p_captured_at,case when v_event.id is null and v_booster.id is not null then v_booster.booster_type else null end,case when v_event.event_type='christmas_party' then 'christmas_party' else null end,null,null,v_cap_override,v_line2_override)
    on conflict(round_id,team_id) do nothing returning id into v_snapshot;
  if v_snapshot is null then select id into v_snapshot from fantasy_team_round_snapshots where round_id=v_round.id and team_id=v_team.id; return v_snapshot; end if;
  insert into fantasy_team_round_snapshot_players(snapshot_id,player_id,position,team,price,is_captain,is_vice_captain,line_no)
    select v_snapshot,fp.id,fp.position,fp.team,tp.purchase_price,tp.is_captain,tp.is_vice_captain,tp.line_no from fantasy_user_team_players tp join fantasy_players fp on fp.id=tp.player_id where tp.team_id=v_team.id;
  if v_event.id is null and v_booster.id is not null and v_booster.status='selected' then update fantasy_bonus_activations set status='committed',committed_at=p_captured_at,updated_at=p_captured_at where id=v_booster.id; end if;
  return v_snapshot;
end; $function$;


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
      select t.id from fantasy_user_teams t where t.season=p_season and t.created_at <= v_round.deadline_at
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

    if v_game_count=0 or v_finished_count<>v_game_count then
      v_unfinished:=v_unfinished+1;
      continue;
    end if;

    if v_points_game_count<>v_game_count then
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
$function$;


CREATE OR REPLACE FUNCTION public.snapshot_fantasy_team_for_round(p_round_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user uuid:=auth.uid();
  v_round fantasy_rounds%rowtype;
  v_team fantasy_user_teams%rowtype;
  v_snapshot uuid;
  v_count integer; v_f integer; v_d integer; v_g integer;
  v_captains integer; v_vice integer; v_value numeric;
  v_l1 integer; v_l1f integer; v_l1d integer; v_l1g integer;
  v_l2 integer; v_l2f integer; v_l2d integer; v_l2g integer;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  select * into v_round from fantasy_rounds where id=p_round_id;
  if not found then raise exception 'Fantasy round not found'; end if;
  if now()<v_round.deadline_at then raise exception 'Round is not locked yet. Deadline is %',v_round.deadline_at; end if;
  select * into v_team from fantasy_user_teams where user_id=v_user and season=v_round.season;
  if not found then raise exception 'No fantasy team found for season %',v_round.season; end if;
  if v_team.created_at > v_round.deadline_at then raise exception 'Team was created after the round deadline'; end if;

  select count(*),
    count(*) filter(where fp.position in('C','W')),
    count(*) filter(where fp.position='D'),
    count(*) filter(where fp.position='G'),
    count(*) filter(where tp.is_captain),
    count(*) filter(where tp.is_vice_captain),
    coalesce(sum(tp.purchase_price),0),
    count(*) filter(where tp.line_no=1),
    count(*) filter(where tp.line_no=1 and fp.position in('C','W')),
    count(*) filter(where tp.line_no=1 and fp.position='D'),
    count(*) filter(where tp.line_no=1 and fp.position='G'),
    count(*) filter(where tp.line_no=2),
    count(*) filter(where tp.line_no=2 and fp.position in('C','W')),
    count(*) filter(where tp.line_no=2 and fp.position='D'),
    count(*) filter(where tp.line_no=2 and fp.position='G')
  into v_count,v_f,v_d,v_g,v_captains,v_vice,v_value,
       v_l1,v_l1f,v_l1d,v_l1g,v_l2,v_l2f,v_l2d,v_l2g
  from fantasy_user_team_players tp
  join fantasy_players fp on fp.id=tp.player_id
  where tp.team_id=v_team.id;

  if v_count<>12 or v_f<>6 or v_d<>4 or v_g<>2 then raise exception 'Cannot snapshot invalid roster: expected 6F/4D/2G, got % players (%F/%D/%G)',v_count,v_f,v_d,v_g; end if;
  if v_captains<>1 or v_vice<>1 then raise exception 'Cannot snapshot team without exactly one captain and one vice-captain'; end if;
  if v_l1<>6 or v_l1f<>3 or v_l1d<>2 or v_l1g<>1 or v_l2<>6 or v_l2f<>3 or v_l2d<>2 or v_l2g<>1 then raise exception 'Cannot snapshot invalid lineup: each line must contain 1G/2D/3F'; end if;

  insert into fantasy_team_round_snapshots(round_id,team_id,user_id,season,team_name,squad_value,captured_at)
  values(v_round.id,v_team.id,v_user,v_round.season,v_team.name,v_value,now())
  on conflict(round_id,team_id) do nothing
  returning id into v_snapshot;
  if v_snapshot is null then
    select id into v_snapshot from fantasy_team_round_snapshots where round_id=v_round.id and team_id=v_team.id;
    return v_snapshot;
  end if;

  insert into fantasy_team_round_snapshot_players(snapshot_id,player_id,position,team,price,is_captain,is_vice_captain,line_no)
  select v_snapshot,fp.id,fp.position,fp.team,tp.purchase_price,tp.is_captain,tp.is_vice_captain,tp.line_no
  from fantasy_user_team_players tp
  join fantasy_players fp on fp.id=tp.player_id
  where tp.team_id=v_team.id;
  return v_snapshot;
end;
$function$;


CREATE SCHEMA IF NOT EXISTS fantasy_audit_private;
REVOKE ALL ON SCHEMA fantasy_audit_private FROM PUBLIC, anon, authenticated;
CREATE TABLE fantasy_audit_private.late_entry_correction_20260926 (
 archived_at timestamptz NOT NULL DEFAULT now(),
 snapshot jsonb NOT NULL,
 snapshot_players jsonb NOT NULL,
 round_points jsonb NOT NULL,
 player_points jsonb NOT NULL
);
REVOKE ALL ON fantasy_audit_private.late_entry_correction_20260926 FROM PUBLIC, anon, authenticated;
INSERT INTO fantasy_audit_private.late_entry_correction_20260926(snapshot,snapshot_players,round_points,player_points)
SELECT to_jsonb(s),
 coalesce((select jsonb_agg(to_jsonb(p)) from public.fantasy_team_round_snapshot_players p where p.snapshot_id=s.id),'[]'::jsonb),
 coalesce((select jsonb_agg(to_jsonb(p)) from public.fantasy_team_round_points p where p.snapshot_id=s.id),'[]'::jsonb),
 coalesce((select jsonb_agg(to_jsonb(p)) from public.fantasy_team_round_player_points p where p.snapshot_id=s.id),'[]'::jsonb)
FROM public.fantasy_team_round_snapshots s
JOIN public.fantasy_user_teams t ON t.id=s.team_id
JOIN public.fantasy_rounds r ON r.id=s.round_id
WHERE s.season='2026/27' AND t.created_at>r.deadline_at;
DELETE FROM public.fantasy_team_round_snapshots s
USING public.fantasy_user_teams t, public.fantasy_rounds r
WHERE t.id=s.team_id AND r.id=s.round_id AND s.season='2026/27' AND t.created_at>r.deadline_at;
SELECT public.refresh_fantasy_season_leaderboard_cache_v1('2026/27');
