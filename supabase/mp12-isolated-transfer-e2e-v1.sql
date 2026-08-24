-- MP-12.3 / MP-12.7 – make the authoritative transfer RPC behaviorally testable
-- without ever creating test rows in the real 2026/27 namespace.
--
-- Ordinary authenticated users remain hard-locked to 2026/27. The only extra
-- path is service_role + a season prefixed __e2e_, which is reserved for the
-- service-only synthetic regression harness below.

create or replace function public.apply_fantasy_transfers_v1(
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
  v_role text := coalesce(auth.role(),'');
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
  if p_season<>'2026/27'
     and not (v_role='service_role' and p_season like '__e2e_%') then
    raise exception 'Unsupported fantasy season: %',p_season;
  end if;
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

revoke all on function public.apply_fantasy_transfers_v1(text,text,uuid[],uuid,uuid) from public,anon;
grant execute on function public.apply_fantasy_transfers_v1(text,text,uuid[],uuid,uuid) to authenticated,service_role;

create or replace function public.run_mp12_transfers_e2e_v2()
returns table(check_no integer,check_name text,passed boolean,detail text)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_season constant text:='__e2e_mp12_transfers__';
  v_user uuid:='00000000-0000-4000-8000-000000001206'::uuid;
  v_team uuid; v_round uuid;
  v_f uuid[]; v_d uuid[]; v_g uuid[];
  v_initial uuid[]; v_three uuid[]; v_after_two uuid[]; v_after_four uuid[];
  v_cap uuid; v_vice uuid;
  v_result record; v_status record;
  v_three_blocked boolean:=false; v_three_error text:='';
  v_cancel_blocked boolean:=false; v_cancel_error text:='';
  v_old_sub text:=current_setting('request.jwt.claim.sub',true);
  v_old_role text:=current_setting('request.jwt.claim.role',true);
begin
  delete from fantasy_transfer_items where batch_id in (select id from fantasy_transfer_batches where season=v_season);
  delete from fantasy_transfer_batches where season=v_season;
  delete from fantasy_bonus_activations where season=v_season;
  delete from fantasy_user_teams where season=v_season;
  delete from fantasy_rounds where season=v_season;
  delete from fantasy_player_season_prices where season=v_season;
  delete from fantasy_season_rules where season=v_season;

  select array_agg(id order by id) into v_f from (
    select id from fantasy_players
    where active=true and on_current_roster=true and available_for_purchase=true and position in('C','W')
    order by id limit 8
  ) q;
  select array_agg(id order by id) into v_d from (
    select id from fantasy_players
    where active=true and on_current_roster=true and available_for_purchase=true and position='D'
    order by id limit 5
  ) q;
  select array_agg(id order by id) into v_g from (
    select id from fantasy_players
    where active=true and on_current_roster=true and available_for_purchase=true and position='G'
    order by id limit 3
  ) q;
  if coalesce(array_length(v_f,1),0)<>8 or coalesce(array_length(v_d,1),0)<>5 or coalesce(array_length(v_g,1),0)<>3 then
    raise exception 'Need 8F/5D/3G purchasable current-roster players for transfer E2E';
  end if;

  v_initial:=array[v_f[1],v_f[2],v_f[3],v_f[4],v_f[5],v_f[6],v_d[1],v_d[2],v_d[3],v_d[4],v_g[1],v_g[2]];
  v_three:=array[v_f[7],v_f[2],v_f[3],v_f[4],v_f[5],v_f[6],v_d[5],v_d[2],v_d[3],v_d[4],v_g[3],v_g[2]];
  v_after_two:=array[v_f[7],v_f[2],v_f[3],v_f[4],v_f[5],v_f[6],v_d[5],v_d[2],v_d[3],v_d[4],v_g[1],v_g[2]];
  v_after_four:=array[v_f[7],v_f[8],v_f[3],v_f[4],v_f[5],v_f[6],v_d[5],v_d[2],v_d[3],v_d[4],v_g[3],v_g[2]];
  v_cap:=v_f[3]; v_vice:=v_f[4];

  insert into fantasy_season_rules(season,max_players_per_club,max_transfers_per_round,budget)
  values(v_season,99,2,100);

  insert into fantasy_player_season_prices(season,player_id,price)
  select v_season,x,5 from unnest(array[v_f[1],v_f[2],v_f[3],v_f[4],v_f[5],v_f[6],v_f[7],v_f[8],v_d[1],v_d[2],v_d[3],v_d[4],v_d[5],v_g[1],v_g[2],v_g[3]]) x;

  insert into fantasy_user_teams(user_id,season,name,budget)
  values(v_user,v_season,'MP12 transfer E2E',100) returning id into v_team;

  insert into fantasy_user_team_players(team_id,player_id,purchase_price,is_captain,is_vice_captain,line_no)
  select v_team,x,5,(x=v_cap),(x=v_vice),case
    when x in(v_f[1],v_f[2],v_f[3],v_d[1],v_d[2],v_g[1]) then 1 else 2 end
  from unnest(v_initial) x;

  insert into fantasy_rounds(season,round_no,name,starts_at,deadline_at,ends_at,status)
  values(v_season,1,'MP12 transfer E2E',now(),now()+interval '2 hours',now()+interval '4 hours','open')
  returning id into v_round;

  perform set_config('request.jwt.claim.sub',v_user::text,true);
  perform set_config('request.jwt.claim.role','service_role',true);

  begin
    perform * from apply_fantasy_transfers_v1(v_season,'Three blocked',v_three,v_cap,v_vice);
  exception when others then
    v_three_blocked:=position('Transfer limit exceeded' in sqlerrm)>0;
    v_three_error:=sqlerrm;
  end;

  return query select 1,'Three transfers are blocked without Bytteboost'::text,
    v_three_blocked
      and not exists(select 1 from fantasy_transfer_batches where season=v_season)
      and (select count(*) from fantasy_user_team_players where team_id=v_team)=12,
    coalesce(v_three_error,'no error');

  select * into v_result from apply_fantasy_transfers_v1(v_season,'Two allowed',v_after_two,v_cap,v_vice);
  return query select 2,'Two ordinary transfers succeed and create exact ledger'::text,
    v_result.transfers_used=2 and v_result.transfers_remaining=0
      and (select count(*) from fantasy_transfer_batches where season=v_season)=1
      and (select coalesce(sum(transfer_count),0) from fantasy_transfer_batches where season=v_season)=2
      and (select count(*) from fantasy_transfer_items i join fantasy_transfer_batches b on b.id=i.batch_id where b.season=v_season and i.direction='in')=2
      and (select count(*) from fantasy_transfer_items i join fantasy_transfer_batches b on b.id=i.batch_id where b.season=v_season and i.direction='out')=2,
    format('used=%s remaining=%s batch=%s',v_result.transfers_used,v_result.transfers_remaining,v_result.transfer_batch_id);

  perform * from select_fantasy_booster_v1(v_season,'transfer_boost',v_round);
  select * into v_result from apply_fantasy_transfers_v1(v_season,'Four with boost',v_after_four,v_cap,v_vice);
  select * into v_status from get_fantasy_transfer_status_v1(v_season);

  return query select 3,'Bytteboost allows cumulative four and commits atomically'::text,
    v_result.transfers_used=4 and v_result.transfers_remaining=0
      and v_status.max_transfers_per_round=4 and v_status.transfers_used=4 and v_status.transfers_remaining=0
      and (select status from fantasy_bonus_activations where team_id=v_team and booster_type='transfer_boost')='committed'
      and (select coalesce(sum(transfer_count),0) from fantasy_transfer_batches where season=v_season)=4,
    format('used=%s remaining=%s status=%s',v_result.transfers_used,v_result.transfers_remaining,(select status from fantasy_bonus_activations where team_id=v_team and booster_type='transfer_boost'));

  return query select 4,'Final roster remains exactly 6F/4D/2G with 12 unique players'::text,
    (select count(*) from fantasy_user_team_players where team_id=v_team)=12
      and (select count(distinct player_id) from fantasy_user_team_players where team_id=v_team)=12
      and (select count(*) from fantasy_user_team_players tp join fantasy_players fp on fp.id=tp.player_id where tp.team_id=v_team and fp.position in('C','W'))=6
      and (select count(*) from fantasy_user_team_players tp join fantasy_players fp on fp.id=tp.player_id where tp.team_id=v_team and fp.position='D')=4
      and (select count(*) from fantasy_user_team_players tp join fantasy_players fp on fp.id=tp.player_id where tp.team_id=v_team and fp.position='G')=2,
    '12 players / 6F / 4D / 2G'::text;

  begin
    perform * from cancel_fantasy_booster_v1(v_season,'transfer_boost');
  exception when others then
    v_cancel_blocked:=position('committed or used' in sqlerrm)>0;
    v_cancel_error:=sqlerrm;
  end;
  return query select 5,'Committed Bytteboost cannot be cancelled'::text,v_cancel_blocked,coalesce(v_cancel_error,'no error');

  perform set_config('request.jwt.claim.sub',coalesce(v_old_sub,''),true);
  perform set_config('request.jwt.claim.role',coalesce(v_old_role,''),true);

  delete from fantasy_transfer_items where batch_id in (select id from fantasy_transfer_batches where season=v_season);
  delete from fantasy_transfer_batches where season=v_season;
  delete from fantasy_bonus_activations where season=v_season;
  delete from fantasy_user_teams where season=v_season;
  delete from fantasy_rounds where season=v_season;
  delete from fantasy_player_season_prices where season=v_season;
  delete from fantasy_season_rules where season=v_season;

  return query select 6,'Synthetic transfer fixtures cleaned'::text,
    not exists(select 1 from fantasy_transfer_batches where season=v_season)
      and not exists(select 1 from fantasy_bonus_activations where season=v_season)
      and not exists(select 1 from fantasy_user_teams where season=v_season)
      and not exists(select 1 from fantasy_rounds where season=v_season)
      and not exists(select 1 from fantasy_player_season_prices where season=v_season)
      and not exists(select 1 from fantasy_season_rules where season=v_season),
    'cleanup complete'::text;
exception when others then
  perform set_config('request.jwt.claim.sub',coalesce(v_old_sub,''),true);
  perform set_config('request.jwt.claim.role',coalesce(v_old_role,''),true);
  delete from fantasy_transfer_items where batch_id in (select id from fantasy_transfer_batches where season=v_season);
  delete from fantasy_transfer_batches where season=v_season;
  delete from fantasy_bonus_activations where season=v_season;
  delete from fantasy_user_teams where season=v_season;
  delete from fantasy_rounds where season=v_season;
  delete from fantasy_player_season_prices where season=v_season;
  delete from fantasy_season_rules where season=v_season;
  raise;
end;
$$;

revoke all on function public.run_mp12_transfers_e2e_v2() from public,anon,authenticated;
grant execute on function public.run_mp12_transfers_e2e_v2() to service_role;
