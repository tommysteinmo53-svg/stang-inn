-- MP-07.11 + MP-07.12 — production Event Weeks for EHL Fantasy 2026/27.
-- GW15 rich_uncle: separate 200m event team.
-- GW22 christmas_party: permanent team snapshot, both lines 100%, normal C/VC.
-- GW38 poor_uncle: separate 70m event team.
-- No historical snapshots or scoring rows are rewritten by this migration.

-- 1) Extend the Event Week model with Julebord. Julebord has no separate event budget/team.
alter table public.fantasy_event_weeks alter column event_budget drop not null;
alter table public.fantasy_event_weeks drop constraint if exists fantasy_event_weeks_check;
alter table public.fantasy_event_weeks drop constraint if exists fantasy_event_weeks_event_type_check;
alter table public.fantasy_event_weeks
  add constraint fantasy_event_weeks_event_type_check
  check (event_type in ('rich_uncle','christmas_party','poor_uncle'));
alter table public.fantasy_event_weeks
  add constraint fantasy_event_weeks_check
  check (
    (event_type='rich_uncle' and event_budget=200.00)
    or (event_type='poor_uncle' and event_budget=70.00)
    or (event_type='christmas_party' and event_budget is null)
  );

-- 2) Snapshot metadata may now identify Julebord without a separate source event team.
alter table public.fantasy_team_round_snapshots drop constraint if exists fantasy_snapshot_event_type_check;
alter table public.fantasy_team_round_snapshots drop constraint if exists fantasy_snapshot_event_metadata_check;
alter table public.fantasy_team_round_snapshots
  add constraint fantasy_snapshot_event_type_check
  check (event_type is null or event_type in ('rich_uncle','christmas_party','poor_uncle'));
alter table public.fantasy_team_round_snapshots
  add constraint fantasy_snapshot_event_metadata_check
  check (
    (event_type is null and event_budget is null and source_event_team_id is null)
    or (event_type='rich_uncle' and event_budget=200.00 and source_event_team_id is not null)
    or (event_type='poor_uncle' and event_budget=70.00 and source_event_team_id is not null)
    or (event_type='christmas_party' and event_budget is null and source_event_team_id is null and line2_multiplier_override=1.00 and captain_multiplier_override is null)
  );

-- 3) Authoritative freeze: rich/poor freeze separate event teams; Julebord freezes the permanent team.
create or replace function public.freeze_fantasy_team_for_round_internal(
  p_team_id uuid,
  p_round_id uuid,
  p_captured_at timestamptz default now()
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_round fantasy_rounds%rowtype;
  v_team fantasy_user_teams%rowtype;
  v_snapshot uuid;
  v_count integer; v_f integer; v_d integer; v_g integer;
  v_captains integer; v_vice integer; v_value numeric;
  v_l1 integer; v_l1f integer; v_l1d integer; v_l1g integer;
  v_l2 integer; v_l2f integer; v_l2d integer; v_l2g integer;
  v_event fantasy_event_weeks%rowtype;
  v_event_team fantasy_event_teams%rowtype;
  v_booster fantasy_bonus_activations%rowtype;
  v_cap_override numeric(5,2);
  v_line2_override numeric(5,2);
begin
  select * into v_round from fantasy_rounds where id=p_round_id;
  if not found then raise exception 'Fantasy round not found'; end if;

  select * into v_team from fantasy_user_teams where id=p_team_id;
  if not found then raise exception 'Fantasy team not found'; end if;
  if v_team.season is distinct from v_round.season then
    raise exception 'Team season % does not match round season %',v_team.season,v_round.season;
  end if;

  select s.id into v_snapshot
  from fantasy_team_round_snapshots s
  where s.round_id=v_round.id and s.team_id=v_team.id;
  if v_snapshot is not null then return v_snapshot; end if;

  select * into v_event
  from fantasy_event_weeks ew
  where ew.season=v_round.season and ew.round_id=v_round.id;

  -- Rich/Poor Uncle use the physically separate event roster.
  if v_event.id is not null and v_event.event_type in ('rich_uncle','poor_uncle') then
    if exists(
      select 1 from fantasy_bonus_activations a
      where a.team_id=v_team.id and a.round_id=v_round.id
        and a.status in ('selected','committed','used')
    ) then
      raise exception 'Personal boosters cannot coexist with an Event Week';
    end if;

    select * into v_event_team
    from fantasy_event_teams et
    where et.event_week_id=v_event.id
      and et.permanent_team_id=v_team.id
      and et.user_id=v_team.user_id;
    if not found then raise exception 'Event team is missing for %',v_event.event_type; end if;
    if v_event_team.season is distinct from v_round.season then raise exception 'Event team season mismatch'; end if;
    if v_event_team.budget is distinct from v_event.event_budget then raise exception 'Event team budget metadata mismatch'; end if;

    select count(*),
      count(*) filter(where fp.position in ('C','W')),
      count(*) filter(where fp.position='D'),
      count(*) filter(where fp.position='G'),
      count(*) filter(where ep.is_captain),
      count(*) filter(where ep.is_vice_captain),
      coalesce(sum(ep.purchase_price),0),
      count(*) filter(where ep.line_no=1),
      count(*) filter(where ep.line_no=1 and fp.position in ('C','W')),
      count(*) filter(where ep.line_no=1 and fp.position='D'),
      count(*) filter(where ep.line_no=1 and fp.position='G'),
      count(*) filter(where ep.line_no=2),
      count(*) filter(where ep.line_no=2 and fp.position in ('C','W')),
      count(*) filter(where ep.line_no=2 and fp.position='D'),
      count(*) filter(where ep.line_no=2 and fp.position='G')
    into v_count,v_f,v_d,v_g,v_captains,v_vice,v_value,
         v_l1,v_l1f,v_l1d,v_l1g,v_l2,v_l2f,v_l2d,v_l2g
    from fantasy_event_team_players ep
    join fantasy_players fp on fp.id=ep.player_id
    where ep.event_team_id=v_event_team.id;

    if v_count<>12 or v_f<>6 or v_d<>4 or v_g<>2 then
      raise exception 'Cannot freeze invalid event roster: expected 6F/4D/2G, got % players (%F/%D/%G)',v_count,v_f,v_d,v_g;
    end if;
    if v_captains<>1 or v_vice<>1 then raise exception 'Cannot freeze event team without exactly one captain and one vice-captain'; end if;
    if v_l1<>6 or v_l1f<>3 or v_l1d<>2 or v_l1g<>1 or v_l2<>6 or v_l2f<>3 or v_l2d<>2 or v_l2g<>1 then
      raise exception 'Cannot freeze invalid event lineup: each line must contain 1G/2D/3F';
    end if;
    if v_value>v_event.event_budget then raise exception 'Event budget exceeded at snapshot: %m > %m',v_value,v_event.event_budget; end if;

    insert into fantasy_team_round_snapshots(
      round_id,team_id,user_id,season,team_name,squad_value,captured_at,
      booster_type,event_type,event_budget,source_event_team_id,
      captain_multiplier_override,line2_multiplier_override
    ) values(
      v_round.id,v_team.id,v_team.user_id,v_round.season,v_team.name,v_value,p_captured_at,
      null,v_event.event_type,v_event.event_budget,v_event_team.id,null,null
    )
    on conflict(round_id,team_id) do nothing returning id into v_snapshot;

    if v_snapshot is null then
      select id into v_snapshot from fantasy_team_round_snapshots where round_id=v_round.id and team_id=v_team.id;
      return v_snapshot;
    end if;

    insert into fantasy_team_round_snapshot_players(snapshot_id,player_id,position,team,price,is_captain,is_vice_captain,line_no)
    select v_snapshot,fp.id,fp.position,fp.team,ep.purchase_price,ep.is_captain,ep.is_vice_captain,ep.line_no
    from fantasy_event_team_players ep join fantasy_players fp on fp.id=ep.player_id
    where ep.event_team_id=v_event_team.id;
    return v_snapshot;
  end if;

  -- Ordinary/Julebord rounds freeze the permanent roster.
  select count(*),
    count(*) filter(where fp.position in ('C','W')),
    count(*) filter(where fp.position='D'),
    count(*) filter(where fp.position='G'),
    count(*) filter(where tp.is_captain),
    count(*) filter(where tp.is_vice_captain),
    coalesce(sum(tp.purchase_price),0),
    count(*) filter(where tp.line_no=1),
    count(*) filter(where tp.line_no=1 and fp.position in ('C','W')),
    count(*) filter(where tp.line_no=1 and fp.position='D'),
    count(*) filter(where tp.line_no=1 and fp.position='G'),
    count(*) filter(where tp.line_no=2),
    count(*) filter(where tp.line_no=2 and fp.position in ('C','W')),
    count(*) filter(where tp.line_no=2 and fp.position='D'),
    count(*) filter(where tp.line_no=2 and fp.position='G')
  into v_count,v_f,v_d,v_g,v_captains,v_vice,v_value,
       v_l1,v_l1f,v_l1d,v_l1g,v_l2,v_l2f,v_l2d,v_l2g
  from fantasy_user_team_players tp join fantasy_players fp on fp.id=tp.player_id
  where tp.team_id=v_team.id;

  if v_count<>12 or v_f<>6 or v_d<>4 or v_g<>2 then
    raise exception 'Cannot freeze invalid roster: expected 6F/4D/2G, got % players (%F/%D/%G)',v_count,v_f,v_d,v_g;
  end if;
  if v_captains<>1 or v_vice<>1 then raise exception 'Cannot freeze team without exactly one captain and one vice-captain'; end if;
  if v_l1<>6 or v_l1f<>3 or v_l1d<>2 or v_l1g<>1 or v_l2<>6 or v_l2f<>3 or v_l2d<>2 or v_l2g<>1 then
    raise exception 'Cannot freeze invalid lineup: each line must contain 1G/2D/3F';
  end if;

  if v_event.id is not null and v_event.event_type='christmas_party' then
    if exists(
      select 1 from fantasy_bonus_activations a
      where a.team_id=v_team.id and a.round_id=v_round.id
        and a.status in ('selected','committed','used')
    ) then
      raise exception 'Personal boosters cannot coexist with an Event Week';
    end if;
    v_cap_override:=null;       -- ordinary season captain multiplier (2.00)
    v_line2_override:=1.00;     -- Alle skal med: second line counts 100%
  else
    select * into v_booster
    from fantasy_bonus_activations a
    where a.team_id=v_team.id and a.round_id=v_round.id
      and a.status in ('selected','committed','used')
    order by a.updated_at desc limit 1;
    v_cap_override := case when v_booster.id is not null and v_booster.booster_type='captain_boost' then 2.50 else null end;
    v_line2_override := case when v_booster.id is not null and v_booster.booster_type='line_boost' then 1.00 else null end;
  end if;

  insert into fantasy_team_round_snapshots(
    round_id,team_id,user_id,season,team_name,squad_value,captured_at,
    booster_type,event_type,event_budget,source_event_team_id,
    captain_multiplier_override,line2_multiplier_override
  ) values(
    v_round.id,v_team.id,v_team.user_id,v_round.season,v_team.name,v_value,p_captured_at,
    case when v_event.id is null and v_booster.id is not null then v_booster.booster_type else null end,
    case when v_event.event_type='christmas_party' then 'christmas_party' else null end,
    null,null,v_cap_override,v_line2_override
  )
  on conflict(round_id,team_id) do nothing returning id into v_snapshot;

  if v_snapshot is null then
    select id into v_snapshot from fantasy_team_round_snapshots where round_id=v_round.id and team_id=v_team.id;
    return v_snapshot;
  end if;

  insert into fantasy_team_round_snapshot_players(snapshot_id,player_id,position,team,price,is_captain,is_vice_captain,line_no)
  select v_snapshot,fp.id,fp.position,fp.team,tp.purchase_price,tp.is_captain,tp.is_vice_captain,tp.line_no
  from fantasy_user_team_players tp join fantasy_players fp on fp.id=tp.player_id
  where tp.team_id=v_team.id;

  if v_event.id is null and v_booster.id is not null and v_booster.status='selected' then
    update fantasy_bonus_activations
    set status='committed',committed_at=p_captured_at,updated_at=p_captured_at
    where id=v_booster.id;
  end if;
  return v_snapshot;
end;
$$;
revoke all on function public.freeze_fantasy_team_for_round_internal(uuid,uuid,timestamptz) from public,authenticated,anon;

-- 4) Small authenticated read model used by calendar/team/booster UI.
create or replace function public.get_fantasy_event_schedule_v1(p_season text)
returns table(event_week_id uuid,event_type text,event_budget numeric,round_id uuid,round_no integer,round_name text,deadline_at timestamptz,is_published boolean)
language plpgsql stable security definer set search_path=public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  return query
  select ew.id,ew.event_type,ew.event_budget::numeric,r.id,r.round_no,r.name,r.deadline_at,ew.is_published
  from fantasy_event_weeks ew join fantasy_rounds r on r.id=ew.round_id
  where ew.season=p_season and r.season=p_season and r.round_no<9000 and ew.is_published=true
  order by r.round_no;
end;
$$;
revoke all on function public.get_fantasy_event_schedule_v1(text) from public,anon;
grant execute on function public.get_fantasy_event_schedule_v1(text) to authenticated;

-- 5) Production schedule assertions and configuration. IDs are resolved from authoritative rounds.
do $$
declare
  v15 uuid; v22 uuid; v38 uuid;
  c15 int; c22 int; c38 int;
begin
  select id into strict v15 from fantasy_rounds where season='2026/27' and round_no=15 and deadline_at='2026-11-12 17:30:00+00';
  select id into strict v22 from fantasy_rounds where season='2026/27' and round_no=22 and deadline_at='2026-12-03 17:30:00+00';
  select id into strict v38 from fantasy_rounds where season='2026/27' and round_no=38 and deadline_at='2027-02-18 17:00:00+00';

  select count(*) into c15 from fantasy_games where fantasy_round_id=v15;
  select count(*) into c22 from fantasy_games where fantasy_round_id=v22;
  select count(*) into c38 from fantasy_games where fantasy_round_id=v38;
  if c15<>5 or c22<>5 or c38<>5 then raise exception 'Event Week fixture count mismatch: GW15 %, GW22 %, GW38 %',c15,c22,c38; end if;

  if exists(select 1 from fantasy_team_round_snapshots where season='2026/27' and round_id in(v15,v22,v38)) then
    raise exception 'Refusing Event Week configuration after snapshots already exist';
  end if;
  if exists(select 1 from fantasy_team_round_points where season='2026/27' and round_id in(v15,v22,v38)) then
    raise exception 'Refusing Event Week configuration after scoring already exists';
  end if;
  if exists(select 1 from fantasy_bonus_activations where season='2026/27' and round_id in(v15,v22,v38) and status in('selected','committed','used')) then
    raise exception 'Refusing Event Week configuration while personal boosters are assigned to an event round';
  end if;
  if exists(select 1 from fantasy_transfer_batches where season='2026/27' and round_id in(v15,v22,v38)) then
    raise exception 'Refusing Event Week configuration after permanent transfers were registered in an event round';
  end if;

  insert into fantasy_event_weeks(season,round_id,event_type,event_budget,is_published,updated_at)
  values
    ('2026/27',v15,'rich_uncle',200.00,true,now()),
    ('2026/27',v22,'christmas_party',null,true,now()),
    ('2026/27',v38,'poor_uncle',70.00,true,now())
  on conflict(round_id) do update set
    event_type=excluded.event_type,event_budget=excluded.event_budget,is_published=true,updated_at=now();
end $$;

comment on function public.get_fantasy_event_schedule_v1(text) is
  'MP-07.11/07.12 authenticated published Event Week calendar for 2026/27 UI.';
comment on function public.freeze_fantasy_team_for_round_internal(uuid,uuid,timestamptz) is
  'Authoritative freeze: rich/poor use separate event teams; christmas_party freezes permanent team with line2 x1.00 and ordinary C/VC.';
