-- Stang Inn Fantasy Hockey – v0.32
-- Mid-season EHL player lifecycle for 2026/27.
-- Goals:
--   * roster discovery/import must never auto-publish a fantasy price
--   * new players enter an admin review queue
--   * approved prices are inserted once into fantasy_player_season_prices
--   * players missing from the current EHL roster remain historical records
--   * departed players become unavailable for NEW purchases without breaking existing ownership

alter table fantasy_players
  add column if not exists on_current_roster boolean not null default true,
  add column if not exists available_for_purchase boolean not null default true;

-- Existing 2026/27 locked-price players are the currently published launch pool.
-- Historical/unpriced rows are not made purchasable by this migration.
update fantasy_players fp
set on_current_roster = exists(
      select 1 from fantasy_player_season_prices sp
      where sp.season='2026/27' and sp.player_id=fp.id
    ),
    available_for_purchase = exists(
      select 1 from fantasy_player_season_prices sp
      where sp.season='2026/27' and sp.player_id=fp.id
    );

create table if not exists fantasy_player_admin_queue (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  player_id uuid not null references fantasy_players(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  detected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  position_source text,
  suggested_price numeric(10,2),
  suggestion_model text,
  price_confidence text,
  pricing_basis jsonb,
  needs_manual_price boolean not null default true,
  approved_price numeric(10,2),
  approved_by uuid,
  approved_at timestamptz,
  rejected_by uuid,
  rejected_at timestamptz,
  admin_note text,
  unique(season,player_id)
);

create index if not exists fantasy_player_admin_queue_status_idx
  on fantasy_player_admin_queue(season,status,detected_at);

alter table fantasy_player_admin_queue enable row level security;

drop policy if exists "Admins can read fantasy player admin queue" on fantasy_player_admin_queue;
create policy "Admins can read fantasy player admin queue"
on fantasy_player_admin_queue for select to authenticated
using (exists(select 1 from players p where p.id=auth.uid() and p.admin=true));

-- Normal users get no INSERT/UPDATE/DELETE policies on the queue.

create or replace function set_fantasy_player_price_suggestion_v1(
  p_queue_id uuid,
  p_suggested_price numeric,
  p_model text,
  p_confidence text,
  p_basis jsonb,
  p_needs_manual boolean
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_q fantasy_player_admin_queue%rowtype;
begin
  select * into v_q
  from fantasy_player_admin_queue
  where id=p_queue_id
  for update;

  if not found then raise exception 'Fantasy player queue item not found'; end if;
  if v_q.status<>'pending' then raise exception 'Only pending queue items can receive a price suggestion'; end if;

  if p_suggested_price is not null and (
    p_suggested_price<1 or p_suggested_price>20 or mod(p_suggested_price*2,1)<>0
  ) then
    raise exception 'Suggested price must be 1.0–20.0 in 0.5m steps';
  end if;

  update fantasy_player_admin_queue
  set suggested_price=p_suggested_price,
      suggestion_model=nullif(trim(p_model),''),
      price_confidence=nullif(trim(p_confidence),''),
      pricing_basis=coalesce(p_basis,'{}'::jsonb),
      needs_manual_price=coalesce(p_needs_manual,true),
      updated_at=now()
  where id=p_queue_id;

  return jsonb_build_object(
    'queueId',p_queue_id,
    'suggestedPrice',p_suggested_price,
    'needsManualPrice',coalesce(p_needs_manual,true)
  );
end;
$$;

revoke all on function set_fantasy_player_price_suggestion_v1(uuid,numeric,text,text,jsonb,boolean) from public;
grant execute on function set_fantasy_player_price_suggestion_v1(uuid,numeric,text,text,jsonb,boolean) to service_role;

create or replace function approve_fantasy_player_price_v1(
  p_queue_id uuid,
  p_admin uuid,
  p_price numeric,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_q fantasy_player_admin_queue%rowtype;
  v_player fantasy_players%rowtype;
  v_publication uuid;
begin
  if not exists(select 1 from players where id=p_admin and admin=true) then
    raise exception 'Publisher is not an admin';
  end if;

  if p_price<1 or p_price>20 or mod(p_price*2,1)<>0 then
    raise exception 'Approved price must be 1.0–20.0 in 0.5m steps';
  end if;

  select * into v_q
  from fantasy_player_admin_queue
  where id=p_queue_id
  for update;

  if not found then raise exception 'Fantasy player queue item not found'; end if;
  if v_q.season<>'2026/27' then raise exception 'Unsupported fantasy season: %',v_q.season; end if;
  if v_q.status<>'pending' then raise exception 'Queue item is not pending'; end if;

  select * into v_player
  from fantasy_players
  where id=v_q.player_id
  for update;

  if not found then raise exception 'Fantasy player not found'; end if;
  if not v_player.on_current_roster then
    raise exception 'Player is no longer on the current EHL roster';
  end if;
  if v_player.position not in ('C','W','D','G') then
    raise exception 'Player has no valid fantasy position';
  end if;

  if exists(
    select 1 from fantasy_player_season_prices sp
    where sp.season=v_q.season and sp.player_id=v_q.player_id
  ) then
    raise exception '2026/27 price is already locked for this player';
  end if;

  insert into fantasy_player_season_prices(season,player_id,price,locked_at)
  values(v_q.season,v_q.player_id,p_price,now());

  -- Keep the legacy price column aligned for diagnostics only.
  update fantasy_players
  set price=p_price,
      available_for_purchase=true,
      updated_at=now()
  where id=v_q.player_id;

  insert into fantasy_price_publications(season,model_version,published_by,player_count,note)
  values(v_q.season,coalesce(nullif(v_q.suggestion_model,''),'MIDSEASON_ADMIN_V1'),p_admin,1,
         coalesce(nullif(trim(p_note),''),'Mid-season player price approval'))
  returning id into v_publication;

  insert into fantasy_price_publication_rows(
    publication_id,player_id,player_name,team,position,old_price,new_price,
    routing,confidence,source
  ) values (
    v_publication,v_player.id,v_player.name,v_player.team,v_player.position,null,p_price,
    'midseason-admin-queue',v_q.price_confidence,
    coalesce(v_q.suggestion_model,'manual')
  );

  update fantasy_player_admin_queue
  set status='approved',
      approved_price=p_price,
      approved_by=p_admin,
      approved_at=now(),
      admin_note=coalesce(p_note,admin_note),
      updated_at=now()
  where id=p_queue_id;

  return jsonb_build_object(
    'queueId',p_queue_id,
    'playerId',v_player.id,
    'price',p_price,
    'publicationId',v_publication,
    'availableForPurchase',true
  );
end;
$$;

revoke all on function approve_fantasy_player_price_v1(uuid,uuid,numeric,text) from public;
grant execute on function approve_fantasy_player_price_v1(uuid,uuid,numeric,text) to service_role;

create or replace function reject_fantasy_player_queue_v1(
  p_queue_id uuid,
  p_admin uuid,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_q fantasy_player_admin_queue%rowtype;
begin
  if not exists(select 1 from players where id=p_admin and admin=true) then
    raise exception 'Publisher is not an admin';
  end if;

  select * into v_q
  from fantasy_player_admin_queue
  where id=p_queue_id
  for update;
  if not found then raise exception 'Fantasy player queue item not found'; end if;
  if v_q.status<>'pending' then raise exception 'Queue item is not pending'; end if;

  update fantasy_player_admin_queue
  set status='rejected',rejected_by=p_admin,rejected_at=now(),
      admin_note=coalesce(p_note,admin_note),updated_at=now()
  where id=p_queue_id;

  update fantasy_players
  set available_for_purchase=false,updated_at=now()
  where id=v_q.player_id;

  return jsonb_build_object('queueId',p_queue_id,'status','rejected');
end;
$$;

revoke all on function reject_fantasy_player_queue_v1(uuid,uuid,text) from public;
grant execute on function reject_fantasy_player_queue_v1(uuid,uuid,text) to service_role;

-- Database-level purchase guard. Existing ownership is untouched because
-- retained players are not re-inserted by apply_fantasy_transfers_v1().
create or replace function guard_fantasy_player_purchase_v1()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  v_available boolean;
begin
  select fp.available_for_purchase into v_available
  from fantasy_players fp
  where fp.id=new.player_id;

  if coalesce(v_available,false)=false then
    raise exception 'Player is not available for new fantasy purchases';
  end if;
  return new;
end;
$$;

drop trigger if exists fantasy_user_team_players_purchase_guard
  on fantasy_user_team_players;
create trigger fantasy_user_team_players_purchase_guard
before insert on fantasy_user_team_players
for each row execute function guard_fantasy_player_purchase_v1();

-- Replace launch-only roster sync with a variable-size, season-safe version.
-- It keeps historical player rows, marks missing roster members unavailable,
-- and queues every current-roster player that lacks a locked 2026/27 price.
create or replace function sync_fantasy_roster_2026(
  p_rows jsonb,
  p_admin uuid,
  p_duplicate_keep uuid,
  p_duplicate_drop uuid
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_row jsonb;
  v_name text;
  v_team text;
  v_position text;
  v_external text;
  v_count integer;
  v_matches integer;
  v_name_matches integer;
  v_player fantasy_players%rowtype;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_id_matched integer := 0;
  v_name_matched integer := 0;
  v_duplicate_fixed integer := 0;
  v_unavailable integer := 0;
  v_queued integer := 0;
  v_seen uuid[] := array[]::uuid[];
begin
  if jsonb_typeof(p_rows)<>'array' then
    raise exception 'Roster payload must be a JSON array';
  end if;

  v_count:=jsonb_array_length(p_rows);
  if v_count<150 or v_count>350 then
    raise exception 'Unexpected roster size: %',v_count;
  end if;

  if not exists(select 1 from players where id=p_admin and admin=true) then
    raise exception 'Publisher is not an admin';
  end if;

  if p_duplicate_keep is not null and p_duplicate_drop is not null then
    if not exists(select 1 from fantasy_players where id=p_duplicate_keep)
       or not exists(select 1 from fantasy_players where id=p_duplicate_drop) then
      raise exception 'Verified duplicate IDs not found';
    end if;
    if lower((select name from fantasy_players where id=p_duplicate_keep))<>
       lower((select name from fantasy_players where id=p_duplicate_drop)) then
      raise exception 'Duplicate IDs do not refer to the same player name';
    end if;
    update fantasy_players
    set active=false,on_current_roster=false,available_for_purchase=false,
        external_id='legacy-duplicate:'||id::text,updated_at=now()
    where id=p_duplicate_drop;
    v_duplicate_fixed:=1;
  end if;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    v_name:=btrim(v_row->>'name');
    v_team:=btrim(v_row->>'team');
    v_position:=upper(btrim(v_row->>'position'));
    v_external:=case when nullif(btrim(v_row->>'personId'),'') is null
                     then null else 'nif:'||btrim(v_row->>'personId') end;

    if coalesce(v_name,'')='' or coalesce(v_team,'')='' then
      raise exception 'Roster row missing name/team: %',v_row;
    end if;
    if v_position not in ('C','W','D','G') then
      raise exception 'Invalid/missing position for %: %',v_name,v_position;
    end if;

    v_player:=null;
    v_matches:=0;

    if v_external is not null then
      select count(*) into v_matches
      from fantasy_players fp where fp.external_id=v_external;

      if v_matches>1 then
        raise exception 'Ambiguous external ID for %: % (% rows)',v_name,v_external,v_matches;
      end if;

      if v_matches=1 then
        select * into v_player
        from fantasy_players fp where fp.external_id=v_external limit 1;

        select count(*) into v_name_matches
        from fantasy_players fp
        where fp.active=true and lower(fp.name)=lower(v_name) and fp.id<>v_player.id;
        if v_name_matches>0 then
          raise exception 'Identity conflict for %: external ID % maps to %, but another active row has the roster name',
            v_name,v_external,v_player.name;
        end if;

        update fantasy_players
        set name=v_name,team=v_team,position=v_position,active=true,
            on_current_roster=true,
            available_for_purchase=exists(
              select 1 from fantasy_player_season_prices sp
              where sp.season='2026/27' and sp.player_id=v_player.id
            ),
            updated_at=now()
        where id=v_player.id
        returning * into v_player;

        v_seen:=array_append(v_seen,v_player.id);
        v_updated:=v_updated+1;
        v_id_matched:=v_id_matched+1;
        continue;
      end if;
    end if;

    select count(*) into v_name_matches
    from fantasy_players fp
    where fp.active=true and lower(fp.name)=lower(v_name);

    if v_name_matches>1 then
      raise exception 'Ambiguous active fantasy_players match for %: %',v_name,v_name_matches;
    end if;

    if v_name_matches=1 then
      select * into v_player
      from fantasy_players fp
      where fp.active=true and lower(fp.name)=lower(v_name)
      limit 1;

      update fantasy_players
      set team=v_team,position=v_position,
          external_id=coalesce(v_external,external_id),
          active=true,on_current_roster=true,
          available_for_purchase=exists(
            select 1 from fantasy_player_season_prices sp
            where sp.season='2026/27' and sp.player_id=v_player.id
          ),
          updated_at=now()
      where id=v_player.id
      returning * into v_player;

      v_seen:=array_append(v_seen,v_player.id);
      v_updated:=v_updated+1;
      v_name_matched:=v_name_matched+1;
    else
      insert into fantasy_players(
        external_id,name,team,position,price,active,on_current_roster,available_for_purchase
      ) values (
        v_external,v_name,v_team,v_position,null,true,true,false
      ) returning * into v_player;

      v_seen:=array_append(v_seen,v_player.id);
      v_inserted:=v_inserted+1;
    end if;
  end loop;

  -- Never delete historical players. A player absent from this full roster is
  -- simply no longer a valid NEW purchase. Existing team rows remain intact.
  update fantasy_players fp
  set on_current_roster=false,available_for_purchase=false,updated_at=now()
  where fp.on_current_roster=true
    and not (fp.id=any(v_seen));
  get diagnostics v_unavailable=row_count;

  insert into fantasy_player_admin_queue(
    season,player_id,status,detected_at,updated_at,position_source,needs_manual_price
  )
  select '2026/27',fp.id,'pending',now(),now(),
         coalesce(nullif(r.position_source,''),'roster-sync'),true
  from fantasy_players fp
  join (
    select lower(btrim(value->>'name')) as player_name,
           btrim(value->>'positionSource') as position_source
    from jsonb_array_elements(p_rows)
  ) r on r.player_name=lower(fp.name)
  where fp.id=any(v_seen)
    and not exists(
      select 1 from fantasy_player_season_prices sp
      where sp.season='2026/27' and sp.player_id=fp.id
    )
  on conflict(season,player_id) do update
  set updated_at=now(),
      position_source=coalesce(excluded.position_source,fantasy_player_admin_queue.position_source)
  where fantasy_player_admin_queue.status='pending';

  select count(*)::integer into v_queued
  from fantasy_player_admin_queue q
  where q.season='2026/27' and q.status='pending'
    and q.player_id=any(v_seen)
    and not exists(
      select 1 from fantasy_player_season_prices sp
      where sp.season=q.season and sp.player_id=q.player_id
    );

  return jsonb_build_object(
    'rosterCount',v_count,
    'inserted',v_inserted,
    'updated',v_updated,
    'idMatched',v_id_matched,
    'nameMatched',v_name_matched,
    'duplicateFixed',v_duplicate_fixed,
    'madeUnavailable',v_unavailable,
    'pendingPriceReview',v_queued
  );
end;
$$;

revoke all on function sync_fantasy_roster_2026(jsonb,uuid,uuid,uuid) from public;
grant execute on function sync_fantasy_roster_2026(jsonb,uuid,uuid,uuid) to service_role;

comment on column fantasy_players.on_current_roster is
  'True when the player was present in the latest full EHL roster sync.';
comment on column fantasy_players.available_for_purchase is
  'Controls NEW Fantasy ownership. Existing owners keep historical team rows even when false.';
comment on table fantasy_player_admin_queue is
  'Admin-only queue for newly discovered/unpriced EHL players before fixed 2026/27 Fantasy price publication.';
