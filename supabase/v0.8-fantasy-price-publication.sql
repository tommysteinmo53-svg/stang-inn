-- Stang Inn Fantasy Hockey – v0.8
-- Atomic publication + audit trail for 2026/27 start prices.

create table if not exists fantasy_price_publications (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  model_version text not null,
  published_by uuid,
  published_at timestamptz not null default now(),
  player_count integer not null,
  note text
);

create table if not exists fantasy_price_publication_rows (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references fantasy_price_publications(id) on delete cascade,
  player_id uuid not null references fantasy_players(id) on delete restrict,
  player_name text not null,
  team text not null,
  position text not null,
  old_price numeric(10,2),
  new_price numeric(10,2) not null,
  routing text,
  confidence text,
  source text,
  created_at timestamptz not null default now(),
  unique(publication_id, player_id)
);

alter table fantasy_price_publications enable row level security;
alter table fantasy_price_publication_rows enable row level security;

create policy "Admins can read fantasy price publications"
on fantasy_price_publications for select to authenticated
using (exists(select 1 from players p where p.id = auth.uid() and p.admin = true));

create policy "Admins can read fantasy price publication rows"
on fantasy_price_publication_rows for select to authenticated
using (exists(select 1 from players p where p.id = auth.uid() and p.admin = true));

create or replace function publish_fantasy_prices_v461(
  p_rows jsonb,
  p_admin uuid,
  p_season text default '2026/27',
  p_model_version text default 'V4.6.1'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_publication uuid;
  v_row jsonb;
  v_player fantasy_players%rowtype;
  v_matches integer;
  v_price numeric;
  v_count integer;
begin
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Price payload must be a JSON array';
  end if;

  v_count := jsonb_array_length(p_rows);
  if v_count <> 242 then
    raise exception 'Expected exactly 242 price rows, got %', v_count;
  end if;

  if not exists(select 1 from players where id = p_admin and admin = true) then
    raise exception 'Publisher is not an admin';
  end if;

  insert into fantasy_price_publications(season, model_version, published_by, player_count, note)
  values(p_season, p_model_version, p_admin, v_count, 'Atomic V4.6.1 start-price publication')
  returning id into v_publication;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    v_price := (v_row->>'price')::numeric;
    if v_price < 1 or v_price > 20 or mod(v_price * 2, 1) <> 0 then
      raise exception 'Invalid price % for %', v_price, v_row->>'name';
    end if;

    select count(*) into v_matches
    from fantasy_players fp
    where fp.active = true and lower(fp.name) = lower(v_row->>'name');

    if v_matches <> 1 then
      raise exception 'Expected one active fantasy_players match for %, got %', v_row->>'name', v_matches;
    end if;

    select * into v_player
    from fantasy_players fp
    where fp.active = true and lower(fp.name) = lower(v_row->>'name')
    limit 1;

    insert into fantasy_price_publication_rows(
      publication_id, player_id, player_name, team, position, old_price, new_price,
      routing, confidence, source
    ) values (
      v_publication, v_player.id, v_player.name, v_player.team, coalesce(v_row->>'position', v_player.position),
      v_player.price, v_price, v_row->>'routing', v_row->>'confidence', v_row->>'source'
    );

    update fantasy_players
    set price = v_price, updated_at = now()
    where id = v_player.id;
  end loop;

  return v_publication;
end;
$$;

revoke all on function publish_fantasy_prices_v461(jsonb,uuid,text,text) from public;
grant execute on function publish_fantasy_prices_v461(jsonb,uuid,text,text) to service_role;
