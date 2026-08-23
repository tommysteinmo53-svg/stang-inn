-- Stang Inn XI – MP-07.6H
-- Bytteboost: 4 transfers instead of normal 2 for one selected fantasy round.
-- Permanent transfers are blocked during Rik/Fattig Onkel Event Weeks so the
-- permanent 100m roster remains exactly as it was before the event.

create or replace function get_fantasy_transfer_status_v1(p_season text)
returns table(
  team_id uuid,
  effective_round_id uuid,
  effective_round_no integer,
  deadline_at timestamptz,
  max_transfers_per_round integer,
  transfers_used integer,
  transfers_remaining integer,
  team_cost numeric
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_team uuid;
  v_round fantasy_rounds%rowtype;
  v_limit integer;
  v_used integer;
  v_event boolean := false;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select t.id into v_team
  from fantasy_user_teams t
  where t.user_id=v_user and t.season=p_season;
  if v_team is null then raise exception 'Fantasy team not found for season %',p_season; end if;

  select r.* into v_round
  from fantasy_rounds r
  where r.season=p_season and r.deadline_at>now() and r.round_no<9000
  order by r.deadline_at,r.round_no limit 1;
  if not found then raise exception 'No open fantasy round found for season %',p_season; end if;

  select sr.max_transfers_per_round into v_limit
  from fantasy_season_rules sr where sr.season=p_season;
  if v_limit is null then raise exception 'Fantasy season rules missing for %',p_season; end if;

  select exists(
    select 1 from fantasy_event_weeks ew
    where ew.season=p_season and ew.round_id=v_round.id
  ) into v_event;

  -- Bytteboost is a round-specific override, never a season-rule mutation.
  if not v_event and exists(
    select 1 from fantasy_bonus_activations a
    where a.team_id=v_team
      and a.season=p_season
      and a.round_id=v_round.id
      and a.booster_type='transfer_boost'
      and a.status in ('selected','committed')
  ) then
    v_limit:=4;
  end if;

  select coalesce(sum(b.transfer_count),0)::integer into v_used
  from fantasy_transfer_batches b
  where b.team_id=v_team and b.round_id=v_round.id;

  return query
  select v_team,v_round.id,v_round.round_no,v_round.deadline_at,
         case when v_event then 0 else v_limit end,
         v_used,
         case when v_event then 0 else greatest(v_limit-v_used,0) end,
         coalesce((
           select sum(sp.price)
           from fantasy_user_team_players tp
           join fantasy_player_season_prices sp
             on sp.player_id=tp.player_id and sp.season=p_season
           where tp.team_id=v_team
         ),0)::numeric;
end;
$$;

revoke all on function get_fantasy_transfer_status_v1(text) from public;
grant execute on function get_fantasy_transfer_status_v1(text) to authenticated;


create or replace function apply_fantasy_transfers_v1(
  p_season text,
  p_name text,
  p_player_ids uuid[],
  p_captain uuid,
  p_vice_captain uuid
) returns table(
  team_id uuid,
  transfer_batch_id uuid,
  effective_round_id uuid,
  effective_round_no integer,
  transfers_used integer,
  transfers_remaining integer,
  team_cost numeric
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_team uuid;
  v_round fantasy_rounds%rowtype;
  v_limit integer;
  v_used integer;
  v_transfer_count integer;
  v_f integer; v_d integer; v_g integer;
  v_max_club integer; v_club text; v_club_count integer;
  v_cost numeric(10,2);
  v_before numeric(10,2);
  v_batch uuid;
  v_booster fantasy_bonus_activations%rowtype;
  v_new_used integer;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_season<>'2026/27' then raise exception 'Unsupported fantasy season: %',p_season; end if;
  if coalesce(array_length(p_player_ids,1),0)<>12 then raise exception 'Team must contain exactly 12 players'; end if;
  if (select count(distinct x) from unnest(p_player_ids) x)<>12 then raise exception 'Duplicate players are not allowed'; end if;
  if p_captain is null or p_vice_captain is null or p_captain=p_vice_captain then raise exception 'Valid captain and vice-captain are required'; end if;
  if not (p_captain=any(p_player_ids)) or not (p_vice_captain=any(p_player_ids)) then raise exception 'Captain and vice-captain must belong to the roster'; end if;

  select t.id into v_team
  from fantasy_user_teams t
  where t.user_id=v_user and t.season=p_season
  for update;
  if v_team is null then raise exception 'Create an initial fantasy team before making transfers'; end if;

  select r.* into v_round
  from fantasy_rounds r
  where r.season=p_season and r.deadline_at>now() and r.round_no<9000
  order by r.deadline_at,r.round_no limit 1;
  if not found then raise exception 'No open fantasy round found for season %',p_season; end if;

  if exists(
    select 1 from fantasy_event_weeks ew
    where ew.season=p_season and ew.round_id=v_round.id
  ) then
    raise exception 'Permanent transfers are disabled during an Event Week. Edit the temporary event team instead.';
  end if;

  if exists(select 1 from fantasy_team_round_snapshots s where s.team_id=v_team and s.round_id=v_round.id) then
    raise exception 'Team is already frozen for fantasy round %',v_round.round_no;
  end if;

  select sr.max_players_per_club,sr.max_transfers_per_round
  into v_max_club,v_limit
  from fantasy_season_rules sr where sr.season=p_season;
  if v_max_club is null or v_limit is null then raise exception 'Fantasy season rules missing for %',p_season; end if;

  select * into v_booster
  from fantasy_bonus_activations a
  where a.team_id=v_team
    and a.season=p_season
    and a.round_id=v_round.id
    and a.booster_type='transfer_boost'
    and a.status in ('selected','committed')
  for update;

  if found then v_limit:=4; end if;

  select
    count(*) filter(where fp.position in ('C','W')),
    count(*) filter(where fp.position='D'),
    count(*) filter(where fp.position='G'),
    coalesce(sum(sp.price),0)
  into v_f,v_d,v_g,v_cost
  from fantasy_players fp
  join fantasy_player_season_prices sp on sp.player_id=fp.id and sp.season=p_season
  where fp.id=any(p_player_ids) and fp.active=true;

  if v_f+v_d+v_g<>12 then raise exception 'One or more selected players are missing, inactive or have no locked season price'; end if;
  if v_f<>6 or v_d<>4 or v_g<>2 then raise exception 'Invalid roster: expected 6F/4D/2G, got %F/%D/%G',v_f,v_d,v_g; end if;
  if v_cost>100.00 then raise exception 'Budget exceeded: %m > 100.0m',v_cost; end if;

  select fp.team,count(*) into v_club,v_club_count
  from fantasy_players fp
  where fp.id=any(p_player_ids)
  group by fp.team
  having count(*)>v_max_club
  order by count(*) desc limit 1;
  if v_club is not null then raise exception 'Too many players from %: % selected, maximum is %',v_club,v_club_count,v_max_club; end if;

  select count(*)::integer into v_transfer_count
  from unnest(p_player_ids) x
  where not exists(
    select 1 from fantasy_user_team_players tp
    where tp.team_id=v_team and tp.player_id=x
  );

  select coalesce(sum(b.transfer_count),0)::integer into v_used
  from fantasy_transfer_batches b
  where b.team_id=v_team and b.round_id=v_round.id;

  if v_transfer_count=0 then
    update fantasy_user_teams t
    set name=coalesce(nullif(trim(p_name),''),'Mitt lag'),updated_at=now()
    where t.id=v_team;

    update fantasy_user_team_players tp
    set is_captain=(tp.player_id=p_captain),is_vice_captain=(tp.player_id=p_vice_captain)
    where tp.team_id=v_team;

    return query select v_team,null::uuid,v_round.id,v_round.round_no,v_used,greatest(v_limit-v_used,0),v_cost::numeric;
    return;
  end if;

  if v_transfer_count<>(
    select count(*) from fantasy_user_team_players tp
    where tp.team_id=v_team and not(tp.player_id=any(p_player_ids))
  ) then
    raise exception 'Incoming and outgoing transfer counts do not match';
  end if;

  v_new_used:=v_used+v_transfer_count;
  if v_new_used>v_limit then
    raise exception 'Transfer limit exceeded for fantasy round %: maximum %',v_round.round_no,v_limit;
  end if;

  -- Crossing the normal limit commits Bytteboost atomically in the same
  -- transaction as the transfer batch. After this point cancellation is impossible.
  if v_booster.id is not null and v_booster.status='selected' and v_new_used>2 then
    update fantasy_bonus_activations
    set status='committed',committed_at=now(),updated_at=now(),cancelled_at=null
    where id=v_booster.id;
  end if;

  select coalesce(sum(sp.price),0)::numeric(10,2) into v_before
  from fantasy_user_team_players tp
  join fantasy_player_season_prices sp on sp.player_id=tp.player_id and sp.season=p_season
  where tp.team_id=v_team;

  insert into fantasy_transfer_batches(team_id,user_id,season,round_id,transfer_count,before_cost,after_cost)
  values(v_team,v_user,p_season,v_round.id,v_transfer_count,v_before,v_cost)
  returning id into v_batch;

  insert into fantasy_transfer_items(batch_id,player_id,direction,price)
  select v_batch,tp.player_id,'out',sp.price
  from fantasy_user_team_players tp
  join fantasy_player_season_prices sp on sp.player_id=tp.player_id and sp.season=p_season
  where tp.team_id=v_team and not(tp.player_id=any(p_player_ids));

  insert into fantasy_transfer_items(batch_id,player_id,direction,price)
  select v_batch,fp.id,'in',sp.price
  from fantasy_players fp
  join fantasy_player_season_prices sp on sp.player_id=fp.id and sp.season=p_season
  where fp.id=any(p_player_ids)
    and not exists(
      select 1 from fantasy_user_team_players old
      where old.team_id=v_team and old.player_id=fp.id
    );

  delete from fantasy_user_team_players tp
  where tp.team_id=v_team and not(tp.player_id=any(p_player_ids));

  -- Preserve existing transfer behaviour. Line composition is finalized through
  -- the existing set_fantasy_lineup_v1 RPC/UI flow after roster changes.
  insert into fantasy_user_team_players(team_id,player_id,purchase_price,is_captain,is_vice_captain)
  select v_team,fp.id,sp.price,(fp.id=p_captain),(fp.id=p_vice_captain)
  from fantasy_players fp
  join fantasy_player_season_prices sp on sp.player_id=fp.id and sp.season=p_season
  where fp.id=any(p_player_ids)
    and not exists(
      select 1 from fantasy_user_team_players kept
      where kept.team_id=v_team and kept.player_id=fp.id
    );

  update fantasy_user_team_players tp
  set is_captain=(tp.player_id=p_captain),is_vice_captain=(tp.player_id=p_vice_captain)
  where tp.team_id=v_team;

  update fantasy_user_teams t
  set name=coalesce(nullif(trim(p_name),''),'Mitt lag'),updated_at=now()
  where t.id=v_team;

  return query
  select v_team,v_batch,v_round.id,v_round.round_no,v_new_used,
         greatest(v_limit-v_new_used,0),v_cost::numeric;
end;
$$;

revoke all on function apply_fantasy_transfers_v1(text,text,uuid[],uuid,uuid) from public;
grant execute on function apply_fantasy_transfers_v1(text,text,uuid[],uuid,uuid) to authenticated;

comment on function get_fantasy_transfer_status_v1(text) is
  'MP-07.6H: transfer status with round-specific Bytteboost limit 4; Event Weeks expose zero permanent transfers.';
comment on function apply_fantasy_transfers_v1(text,text,uuid[],uuid,uuid) is
  'MP-07.6H: authoritative permanent transfer mutation. Normal max 2; selected Bytteboost max 4 and becomes committed when cumulative usage exceeds 2. Permanent transfers are blocked during Event Weeks.';
