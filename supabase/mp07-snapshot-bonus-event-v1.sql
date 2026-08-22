-- Stang Inn XI – MP-07.6E
-- Snapshot integration for personal boosters + Rik/Fattig Onkel event teams.
-- This migration changes WHAT roster/rule metadata is frozen, but does NOT
-- change the scoring formula yet.

alter table fantasy_team_round_snapshots
  add column if not exists booster_type text,
  add column if not exists event_type text,
  add column if not exists event_budget numeric(10,2),
  add column if not exists source_event_team_id uuid references fantasy_event_teams(id) on delete set null,
  add column if not exists captain_multiplier_override numeric(5,2),
  add column if not exists line2_multiplier_override numeric(5,2);

do $$ begin
  if not exists (select 1 from pg_constraint where conname='fantasy_snapshot_booster_type_check') then
    alter table fantasy_team_round_snapshots
      add constraint fantasy_snapshot_booster_type_check
      check (booster_type is null or booster_type in ('captain_boost','line_boost','transfer_boost'));
  end if;
  if not exists (select 1 from pg_constraint where conname='fantasy_snapshot_event_type_check') then
    alter table fantasy_team_round_snapshots
      add constraint fantasy_snapshot_event_type_check
      check (event_type is null or event_type in ('rich_uncle','poor_uncle'));
  end if;
  if not exists (select 1 from pg_constraint where conname='fantasy_snapshot_event_metadata_check') then
    alter table fantasy_team_round_snapshots
      add constraint fantasy_snapshot_event_metadata_check
      check (
        (event_type is null and event_budget is null and source_event_team_id is null)
        or
        (event_type='rich_uncle' and event_budget=200.00 and source_event_team_id is not null)
        or
        (event_type='poor_uncle' and event_budget=70.00 and source_event_team_id is not null)
      );
  end if;
  if not exists (select 1 from pg_constraint where conname='fantasy_snapshot_no_booster_during_event_check') then
    alter table fantasy_team_round_snapshots
      add constraint fantasy_snapshot_no_booster_during_event_check
      check (not (event_type is not null and booster_type is not null));
  end if;
end $$;

create or replace function freeze_fantasy_team_for_round_internal(
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

  if found then
    -- Event Week: permanent roster remains untouched; freeze only the separate event roster.
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
    if not found then
      raise exception 'Event team is missing for %',v_event.event_type;
    end if;
    if v_event_team.season is distinct from v_round.season then
      raise exception 'Event team season mismatch';
    end if;
    if v_event_team.budget is distinct from v_event.event_budget then
      raise exception 'Event team budget metadata mismatch';
    end if;

    select
      count(*),
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
    if v_captains<>1 or v_vice<>1 then
      raise exception 'Cannot freeze event team without exactly one captain and one vice-captain';
    end if;
    if v_l1<>6 or v_l1f<>3 or v_l1d<>2 or v_l1g<>1 or v_l2<>6 or v_l2f<>3 or v_l2d<>2 or v_l2g<>1 then
      raise exception 'Cannot freeze invalid event lineup: each line must contain 1G/2D/3F';
    end if;
    if v_value>v_event.event_budget then
      raise exception 'Event budget exceeded at snapshot: %m > %m',v_value,v_event.event_budget;
    end if;

    insert into fantasy_team_round_snapshots(
      round_id,team_id,user_id,season,team_name,squad_value,captured_at,
      booster_type,event_type,event_budget,source_event_team_id,
      captain_multiplier_override,line2_multiplier_override
    ) values(
      v_round.id,v_team.id,v_team.user_id,v_round.season,v_team.name,v_value,p_captured_at,
      null,v_event.event_type,v_event.event_budget,v_event_team.id,
      null,null
    )
    on conflict(round_id,team_id) do nothing
    returning id into v_snapshot;

    if v_snapshot is null then
      select id into v_snapshot from fantasy_team_round_snapshots
      where round_id=v_round.id and team_id=v_team.id;
      return v_snapshot;
    end if;

    insert into fantasy_team_round_snapshot_players(
      snapshot_id,player_id,position,team,price,is_captain,is_vice_captain,line_no
    )
    select
      v_snapshot,fp.id,fp.position,fp.team,ep.purchase_price,
      ep.is_captain,ep.is_vice_captain,ep.line_no
    from fantasy_event_team_players ep
    join fantasy_players fp on fp.id=ep.player_id
    where ep.event_team_id=v_event_team.id;

    return v_snapshot;
  end if;

  -- Ordinary round: freeze the permanent roster exactly as before, plus booster metadata.
  select
    count(*),
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
  from fantasy_user_team_players tp
  join fantasy_players fp on fp.id=tp.player_id
  where tp.team_id=v_team.id;

  if v_count<>12 or v_f<>6 or v_d<>4 or v_g<>2 then
    raise exception 'Cannot freeze invalid roster: expected 6F/4D/2G, got % players (%F/%D/%G)',v_count,v_f,v_d,v_g;
  end if;
  if v_captains<>1 or v_vice<>1 then
    raise exception 'Cannot freeze team without exactly one captain and one vice-captain';
  end if;
  if v_l1<>6 or v_l1f<>3 or v_l1d<>2 or v_l1g<>1 or v_l2<>6 or v_l2f<>3 or v_l2d<>2 or v_l2g<>1 then
    raise exception 'Cannot freeze invalid lineup: each line must contain 1G/2D/3F';
  end if;

  select * into v_booster
  from fantasy_bonus_activations a
  where a.team_id=v_team.id
    and a.round_id=v_round.id
    and a.status in ('selected','committed','used')
  order by a.updated_at desc
  limit 1;

  v_cap_override := case when found and v_booster.booster_type='captain_boost' then 2.50 else null end;
  v_line2_override := case when found and v_booster.booster_type='line_boost' then 1.00 else null end;

  insert into fantasy_team_round_snapshots(
    round_id,team_id,user_id,season,team_name,squad_value,captured_at,
    booster_type,event_type,event_budget,source_event_team_id,
    captain_multiplier_override,line2_multiplier_override
  ) values(
    v_round.id,v_team.id,v_team.user_id,v_round.season,v_team.name,v_value,p_captured_at,
    case when found then v_booster.booster_type else null end,
    null,null,null,v_cap_override,v_line2_override
  )
  on conflict(round_id,team_id) do nothing
  returning id into v_snapshot;

  if v_snapshot is null then
    select id into v_snapshot from fantasy_team_round_snapshots
    where round_id=v_round.id and team_id=v_team.id;
    return v_snapshot;
  end if;

  insert into fantasy_team_round_snapshot_players(
    snapshot_id,player_id,position,team,price,is_captain,is_vice_captain,line_no
  )
  select
    v_snapshot,fp.id,fp.position,fp.team,tp.purchase_price,
    tp.is_captain,tp.is_vice_captain,tp.line_no
  from fantasy_user_team_players tp
  join fantasy_players fp on fp.id=tp.player_id
  where tp.team_id=v_team.id;

  if v_booster.id is not null and v_booster.status='selected' then
    update fantasy_bonus_activations
    set status='committed',committed_at=p_captured_at,updated_at=p_captured_at
    where id=v_booster.id;
  end if;

  return v_snapshot;
end;
$$;

revoke all on function freeze_fantasy_team_for_round_internal(uuid,uuid,timestamptz) from public;
revoke all on function freeze_fantasy_team_for_round_internal(uuid,uuid,timestamptz) from authenticated;

comment on function freeze_fantasy_team_for_round_internal(uuid,uuid,timestamptz) is
  'MP-07.6E: authoritative freeze. Event Weeks snapshot the separate event roster; ordinary rounds snapshot the permanent roster plus immutable booster metadata.';
