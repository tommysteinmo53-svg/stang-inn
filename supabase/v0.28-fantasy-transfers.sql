-- Stang Inn Fantasy Hockey – v0.28
-- Transfer foundation for 2026/27.
-- Rules:
--   * maximum 2 transfers per fantasy round
--   * published 2026/27 player prices are fixed for the whole season
--   * all budget checks use the locked season-price table
--   * retained and incoming players therefore always use the same season price
--   * full roster remains 6F/4D/2G, <=100.0m and max players per club
--   * captain/vice-captain changes do not consume a transfer
--   * before the first deadline, the ordinary team builder remains freely editable

alter table fantasy_season_rules
  add column if not exists max_transfers_per_round integer not null default 2
    check (max_transfers_per_round >= 0);

update fantasy_season_rules
set max_transfers_per_round = 2
where season = '2026/27';

-- Immutable season-price snapshot used by the live game.
create table if not exists fantasy_player_season_prices (
  season text not null,
  player_id uuid not null references fantasy_players(id) on delete cascade,
  price numeric(10,2) not null check (price >= 0),
  locked_at timestamptz not null default now(),
  primary key (season, player_id)
);

insert into fantasy_player_season_prices(season,player_id,price)
select '2026/27',fp.id,fp.price
from fantasy_players fp
where fp.price is not null
on conflict (season,player_id) do nothing;

alter table fantasy_player_season_prices enable row level security;
drop policy if exists "Authenticated users can read fantasy season prices" on fantasy_player_season_prices;
create policy "Authenticated users can read fantasy season prices"
on fantasy_player_season_prices for select to authenticated using (true);

create table if not exists fantasy_transfer_batches (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references fantasy_user_teams(id) on delete cascade,
  user_id uuid not null,
  season text not null,
  round_id uuid not null references fantasy_rounds(id) on delete restrict,
  transfer_count integer not null check (transfer_count > 0),
  before_cost numeric(10,2) not null,
  after_cost numeric(10,2) not null,
  created_at timestamptz not null default now()
);

create table if not exists fantasy_transfer_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references fantasy_transfer_batches(id) on delete cascade,
  player_id uuid not null references fantasy_players(id) on delete restrict,
  direction text not null check (direction in ('in','out')),
  price numeric(10,2) not null,
  created_at timestamptz not null default now(),
  unique(batch_id,player_id,direction)
);

create index if not exists fantasy_transfer_batches_team_round_idx
  on fantasy_transfer_batches(team_id,round_id,created_at);
create index if not exists fantasy_transfer_items_batch_idx
  on fantasy_transfer_items(batch_id);

alter table fantasy_transfer_batches enable row level security;
alter table fantasy_transfer_items enable row level security;

drop policy if exists "Users can read own fantasy transfer batches" on fantasy_transfer_batches;
create policy "Users can read own fantasy transfer batches"
on fantasy_transfer_batches for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can read own fantasy transfer items" on fantasy_transfer_items;
create policy "Users can read own fantasy transfer items"
on fantasy_transfer_items for select to authenticated
using (exists (
  select 1 from fantasy_transfer_batches b
  where b.id=fantasy_transfer_items.batch_id and b.user_id=auth.uid()
));

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

  select coalesce(sum(b.transfer_count),0)::integer into v_used
  from fantasy_transfer_batches b
  where b.team_id=v_team and b.round_id=v_round.id;

  return query
  select v_team,v_round.id,v_round.round_no,v_round.deadline_at,v_limit,v_used,
         greatest(v_limit-v_used,0),
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

  if exists(select 1 from fantasy_team_round_snapshots s where s.team_id=v_team and s.round_id=v_round.id) then
    raise exception 'Team is already frozen for fantasy round %',v_round.round_no;
  end if;

  select sr.max_players_per_club,sr.max_transfers_per_round
  into v_max_club,v_limit
  from fantasy_season_rules sr where sr.season=p_season;

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
  where not exists(select 1 from fantasy_user_team_players tp where tp.team_id=v_team and tp.player_id=x);

  select coalesce(sum(b.transfer_count),0)::integer into v_used
  from fantasy_transfer_batches b
  where b.team_id=v_team and b.round_id=v_round.id;

  if v_transfer_count=0 then
    update fantasy_user_teams set name=coalesce(nullif(trim(p_name),''),'Mitt lag'),updated_at=now() where id=v_team;
    update fantasy_user_team_players set is_captain=(player_id=p_captain),is_vice_captain=(player_id=p_vice_captain) where team_id=v_team;
    return query select v_team,null::uuid,v_round.id,v_round.round_no,v_used,greatest(v_limit-v_used,0),v_cost::numeric;
    return;
  end if;

  if v_transfer_count<>(select count(*) from fantasy_user_team_players tp where tp.team_id=v_team and not(tp.player_id=any(p_player_ids))) then
    raise exception 'Incoming and outgoing transfer counts do not match';
  end if;
  if v_used+v_transfer_count>v_limit then
    raise exception 'Transfer limit exceeded for fantasy round %: maximum %',v_round.round_no,v_limit;
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
    and not exists(select 1 from fantasy_user_team_players old where old.team_id=v_team and old.player_id=fp.id);

  delete from fantasy_user_team_players tp
  where tp.team_id=v_team and not(tp.player_id=any(p_player_ids));

  insert into fantasy_user_team_players(team_id,player_id,purchase_price,is_captain,is_vice_captain)
  select v_team,fp.id,sp.price,(fp.id=p_captain),(fp.id=p_vice_captain)
  from fantasy_players fp
  join fantasy_player_season_prices sp on sp.player_id=fp.id and sp.season=p_season
  where fp.id=any(p_player_ids)
    and not exists(select 1 from fantasy_user_team_players kept where kept.team_id=v_team and kept.player_id=fp.id);

  update fantasy_user_team_players
  set is_captain=(player_id=p_captain),is_vice_captain=(player_id=p_vice_captain)
  where team_id=v_team;

  update fantasy_user_teams
  set name=coalesce(nullif(trim(p_name),''),'Mitt lag'),updated_at=now()
  where id=v_team;

  return query
  select v_team,v_batch,v_round.id,v_round.round_no,v_used+v_transfer_count,
         greatest(v_limit-(v_used+v_transfer_count),0),v_cost::numeric;
end;
$$;

revoke all on function apply_fantasy_transfers_v1(text,text,uuid[],uuid,uuid) from public;
grant execute on function apply_fantasy_transfers_v1(text,text,uuid[],uuid,uuid) to authenticated;

-- Initial team builder: after the first real deadline it cannot replace a live roster.
-- All initial purchase prices also come from the locked season-price snapshot.
create or replace function save_fantasy_team_v3(
  p_season text,p_name text,p_player_ids uuid[],p_captain uuid,p_vice_captain uuid
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid:=auth.uid(); v_team uuid; v_f integer; v_d integer; v_g integer;
  v_total numeric; v_max_club integer; v_club text; v_club_count integer;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_season<>'2026/27' then raise exception 'Unsupported fantasy season: %',p_season; end if;
  if coalesce(array_length(p_player_ids,1),0)<>12 then raise exception 'Team must contain exactly 12 players'; end if;
  if (select count(distinct x) from unnest(p_player_ids)x)<>12 then raise exception 'Duplicate players are not allowed'; end if;
  if p_captain is null or p_vice_captain is null or p_captain=p_vice_captain then raise exception 'Valid captain and vice-captain are required'; end if;
  if not(p_captain=any(p_player_ids)) or not(p_vice_captain=any(p_player_ids)) then raise exception 'Captain and vice-captain must belong to the roster'; end if;

  select t.id into v_team from fantasy_user_teams t where t.user_id=v_user and t.season=p_season;
  if v_team is not null and exists(select 1 from fantasy_rounds r where r.season=p_season and r.round_no<9000 and r.deadline_at<=now()) then
    raise exception 'Season has started. Use the transfer system to change an existing roster.';
  end if;

  select max_players_per_club into v_max_club from fantasy_season_rules where season=p_season;

  select count(*) filter(where fp.position in('C','W')),count(*) filter(where fp.position='D'),count(*) filter(where fp.position='G'),coalesce(sum(sp.price),0)
  into v_f,v_d,v_g,v_total
  from fantasy_players fp
  join fantasy_player_season_prices sp on sp.player_id=fp.id and sp.season=p_season
  where fp.id=any(p_player_ids) and fp.active=true;

  if v_f+v_d+v_g<>12 then raise exception 'One or more selected players are missing, inactive or have no locked season price'; end if;
  if v_f<>6 or v_d<>4 or v_g<>2 then raise exception 'Invalid roster: expected 6F/4D/2G, got %F/%D/%G',v_f,v_d,v_g; end if;
  if v_total>100.00 then raise exception 'Budget exceeded: %m > 100.0m',v_total; end if;

  select fp.team,count(*) into v_club,v_club_count
  from fantasy_players fp where fp.id=any(p_player_ids)
  group by fp.team having count(*)>v_max_club order by count(*) desc limit 1;
  if v_club is not null then raise exception 'Too many players from %: % selected, maximum is %',v_club,v_club_count,v_max_club; end if;

  insert into fantasy_user_teams(user_id,season,name,budget,updated_at)
  values(v_user,p_season,coalesce(nullif(trim(p_name),''),'Mitt lag'),100.00,now())
  on conflict(user_id,season) do update set name=excluded.name,budget=excluded.budget,updated_at=now()
  returning id into v_team;

  delete from fantasy_user_team_players where team_id=v_team;
  insert into fantasy_user_team_players(team_id,player_id,purchase_price,is_captain,is_vice_captain)
  select v_team,fp.id,sp.price,(fp.id=p_captain),(fp.id=p_vice_captain)
  from fantasy_players fp
  join fantasy_player_season_prices sp on sp.player_id=fp.id and sp.season=p_season
  where fp.id=any(p_player_ids);

  return v_team;
end;
$$;

revoke all on function save_fantasy_team_v3(text,text,uuid[],uuid,uuid) from public;
grant execute on function save_fantasy_team_v3(text,text,uuid[],uuid,uuid) to authenticated;
