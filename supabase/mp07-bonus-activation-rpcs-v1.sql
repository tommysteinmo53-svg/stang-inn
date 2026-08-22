-- Stang Inn XI – MP-07.6C
-- Secure personal booster selection / cancellation / status RPCs.
-- Does NOT change scoring, snapshots or transfer limits yet.

create or replace function select_fantasy_booster_v1(
  p_season text,
  p_booster_type text,
  p_round_id uuid
) returns table(
  activation_id uuid,
  booster_type text,
  round_id uuid,
  round_no integer,
  deadline_at timestamptz,
  status text
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_team fantasy_user_teams%rowtype;
  v_round fantasy_rounds%rowtype;
  v_existing fantasy_bonus_activations%rowtype;
  v_activation uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_booster_type not in ('captain_boost','line_boost','transfer_boost') then
    raise exception 'Unsupported booster type: %',p_booster_type;
  end if;

  select * into v_team
  from fantasy_user_teams t
  where t.user_id=v_user and t.season=p_season
  for update;
  if not found then raise exception 'Fantasy team not found for season %',p_season; end if;

  select * into v_round
  from fantasy_rounds r
  where r.id=p_round_id and r.season=p_season and r.round_no<9000;
  if not found then raise exception 'Fantasy round not found for season %',p_season; end if;
  if now()>=v_round.deadline_at then
    raise exception 'Booster deadline has passed for fantasy round %',v_round.round_no;
  end if;

  -- Event rounds stand alone. Block even before publication so a future event
  -- configuration cannot silently collide with a personal booster selection.
  if exists(
    select 1 from fantasy_event_weeks ew
    where ew.season=p_season and ew.round_id=v_round.id
  ) then
    raise exception 'Personal boosters cannot be used in an Event Week';
  end if;

  -- One personal booster per team/round.
  if exists(
    select 1 from fantasy_bonus_activations a
    where a.team_id=v_team.id
      and a.round_id=v_round.id
      and a.booster_type<>p_booster_type
      and a.status in ('selected','committed','used')
  ) then
    raise exception 'Another personal booster is already assigned to fantasy round %',v_round.round_no;
  end if;

  select * into v_existing
  from fantasy_bonus_activations a
  where a.team_id=v_team.id
    and a.season=p_season
    and a.booster_type=p_booster_type
  for update;

  if found then
    if v_existing.status in ('committed','used') then
      raise exception 'Booster % is already committed or used and cannot be moved',p_booster_type;
    end if;

    update fantasy_bonus_activations
    set round_id=v_round.id,
        status='selected',
        cancelled_at=null,
        committed_at=null,
        used_at=null,
        updated_at=now()
    where id=v_existing.id
    returning id into v_activation;
  else
    insert into fantasy_bonus_activations(
      user_id,team_id,season,round_id,booster_type,status,updated_at
    ) values(
      v_user,v_team.id,p_season,v_round.id,p_booster_type,'selected',now()
    ) returning id into v_activation;
  end if;

  return query
  select v_activation,p_booster_type,v_round.id,v_round.round_no,v_round.deadline_at,'selected'::text;
end;
$$;

revoke all on function select_fantasy_booster_v1(text,text,uuid) from public;
grant execute on function select_fantasy_booster_v1(text,text,uuid) to authenticated;


create or replace function cancel_fantasy_booster_v1(
  p_season text,
  p_booster_type text
) returns table(
  activation_id uuid,
  booster_type text,
  status text,
  cancelled_at timestamptz
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_team fantasy_user_teams%rowtype;
  v_activation fantasy_bonus_activations%rowtype;
  v_round fantasy_rounds%rowtype;
  v_used integer := 0;
  v_cancelled timestamptz := now();
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_booster_type not in ('captain_boost','line_boost','transfer_boost') then
    raise exception 'Unsupported booster type: %',p_booster_type;
  end if;

  select * into v_team
  from fantasy_user_teams t
  where t.user_id=v_user and t.season=p_season
  for update;
  if not found then raise exception 'Fantasy team not found for season %',p_season; end if;

  select * into v_activation
  from fantasy_bonus_activations a
  where a.team_id=v_team.id
    and a.season=p_season
    and a.booster_type=p_booster_type
  for update;
  if not found then raise exception 'Booster % has not been selected',p_booster_type; end if;

  if v_activation.status='cancelled' then
    return query select v_activation.id,p_booster_type,'cancelled'::text,v_activation.cancelled_at;
    return;
  end if;
  if v_activation.status in ('committed','used') then
    raise exception 'Booster % is already committed or used and cannot be cancelled',p_booster_type;
  end if;

  select * into v_round from fantasy_rounds where id=v_activation.round_id;
  if not found then raise exception 'Fantasy round not found'; end if;
  if now()>=v_round.deadline_at then
    raise exception 'Booster can no longer be cancelled after the fantasy round deadline';
  end if;

  -- Bytteboost becomes irreversible once transfer #3 has been made.
  -- This count uses the existing authoritative transfer ledger.
  if p_booster_type='transfer_boost' then
    select coalesce(sum(b.transfer_count),0)::integer into v_used
    from fantasy_transfer_batches b
    where b.team_id=v_team.id and b.round_id=v_activation.round_id;
    if v_used>2 then
      raise exception 'Bytteboost is committed because more than 2 transfers have been used in this round';
    end if;
  end if;

  update fantasy_bonus_activations
  set status='cancelled',
      cancelled_at=v_cancelled,
      updated_at=v_cancelled
  where id=v_activation.id;

  return query select v_activation.id,p_booster_type,'cancelled'::text,v_cancelled;
end;
$$;

revoke all on function cancel_fantasy_booster_v1(text,text) from public;
grant execute on function cancel_fantasy_booster_v1(text,text) to authenticated;


create or replace function get_my_fantasy_boosters_v1(
  p_season text
) returns table(
  booster_type text,
  activation_id uuid,
  activation_status text,
  round_id uuid,
  round_no integer,
  round_name text,
  deadline_at timestamptz,
  can_select boolean,
  can_cancel boolean,
  transfers_used integer
)
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  return query
  with my_team as (
    select t.id
    from fantasy_user_teams t
    where t.user_id=v_user and t.season=p_season
  ), booster_types as (
    select unnest(array['captain_boost','line_boost','transfer_boost'])::text as booster_type
  )
  select
    bt.booster_type,
    a.id,
    coalesce(a.status,'available')::text,
    a.round_id,
    r.round_no,
    r.name,
    r.deadline_at,
    case
      when a.status in ('committed','used') then false
      else true
    end as can_select,
    case
      when a.status<>'selected' then false
      when r.deadline_at is null or now()>=r.deadline_at then false
      when bt.booster_type='transfer_boost' and coalesce(tx.used,0)>2 then false
      else true
    end as can_cancel,
    coalesce(tx.used,0)::integer
  from booster_types bt
  left join my_team mt on true
  left join fantasy_bonus_activations a
    on a.team_id=mt.id and a.season=p_season and a.booster_type=bt.booster_type
  left join fantasy_rounds r on r.id=a.round_id
  left join lateral (
    select coalesce(sum(b.transfer_count),0)::integer as used
    from fantasy_transfer_batches b
    where b.team_id=mt.id and b.round_id=a.round_id
  ) tx on true
  order by case bt.booster_type
    when 'captain_boost' then 1
    when 'line_boost' then 2
    else 3
  end;
end;
$$;

revoke all on function get_my_fantasy_boosters_v1(text) from public;
grant execute on function get_my_fantasy_boosters_v1(text) to authenticated;

comment on function select_fantasy_booster_v1(text,text,uuid) is
  'MP-07.6C: securely select or move an unused personal booster before deadline; Event Weeks and stacking are blocked server-side.';
comment on function cancel_fantasy_booster_v1(text,text) is
  'MP-07.6C: cancel a selected personal booster before deadline; transfer boost cannot be cancelled after transfer #3.';
comment on function get_my_fantasy_boosters_v1(text) is
  'MP-07.6C: authenticated read model for the three personal booster cards and their current selection/use state.';
