-- MP-03.6 – final preseason fantasy-price calibration for 2026/27.
-- Atomic full-pool publication that keeps fantasy_players.price and
-- fantasy_player_season_prices in sync and preserves the publication audit trail.
-- This does not alter fantasy scoring.

create or replace function publish_fantasy_prices_v462(
  p_rows jsonb,
  p_admin uuid,
  p_season text default '2026/27',
  p_model_version text default 'V4.6.2'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_publication uuid;
  v_row jsonb;
  v_player fantasy_players%rowtype;
  v_price numeric;
  v_old_price numeric;
  v_expected integer;
  v_count integer;
  v_distinct integer;
  v_player_id uuid;
  v_make_available boolean;
  v_economy_lock_at timestamptz;
  v_budget numeric;
  v_overbudget integer;
begin
  if p_season <> '2026/27' or p_model_version <> 'V4.6.2' then
    raise exception 'Unsupported season/model: % / %', p_season, p_model_version;
  end if;

  if not exists(select 1 from players where id = p_admin and admin = true) then
    raise exception 'Publisher is not an admin';
  end if;

  select economy_lock_at, budget into v_economy_lock_at, v_budget
  from fantasy_season_rules where season = p_season;
  if v_budget is null then
    raise exception 'Fantasy season rules missing for %', p_season;
  end if;
  if v_economy_lock_at is not null and now() >= v_economy_lock_at then
    raise exception 'Fantasy economy is locked at %', v_economy_lock_at;
  end if;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Price payload must be a JSON array';
  end if;

  select count(*) into v_expected
  from fantasy_players
  where active = true and on_current_roster = true;

  v_count := jsonb_array_length(p_rows);
  if v_count <> v_expected then
    raise exception 'Expected current roster count % price rows, got %', v_expected, v_count;
  end if;

  select count(distinct (x.value->>'player_id')) into v_distinct
  from jsonb_array_elements(p_rows) x;
  if v_distinct <> v_expected then
    raise exception 'Price payload contains duplicate or missing player ids';
  end if;

  if exists (
    select 1
    from fantasy_players fp
    where fp.active = true and fp.on_current_roster = true
      and not exists (
        select 1 from jsonb_array_elements(p_rows) x
        where (x.value->>'player_id')::uuid = fp.id
      )
  ) then
    raise exception 'Price payload does not cover the full current roster';
  end if;

  -- Pre-publication safety gate: no already saved preseason team may become invalid
  -- because of the calibration. Nothing has been written at this point.
  with proposed as (
    select (x.value->>'player_id')::uuid player_id,
           (x.value->>'price')::numeric price
    from jsonb_array_elements(p_rows) x
  ), team_costs as (
    select t.id, coalesce(sum(pr.price),0)::numeric total_cost
    from fantasy_user_teams t
    join fantasy_user_team_players tp on tp.team_id=t.id
    join proposed pr on pr.player_id=tp.player_id
    where t.season=p_season
    group by t.id
  )
  select count(*) into v_overbudget
  from team_costs where total_cost > v_budget;

  if v_overbudget > 0 then
    raise exception 'Calibration blocked: % saved fantasy team(s) would exceed budget %m', v_overbudget, v_budget;
  end if;

  insert into fantasy_price_publications(season, model_version, published_by, player_count, note)
  values(p_season, p_model_version, p_admin, v_count,
    'MP-03.6 final preseason calibration: V4.6.1 base + approved 2026/27 calibration adjustments')
  returning id into v_publication;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    v_player_id := (v_row->>'player_id')::uuid;
    v_price := (v_row->>'price')::numeric;
    v_make_available := coalesce((v_row->>'make_available')::boolean, false);

    if v_price < 1 or v_price > 20 or mod(v_price * 2, 1) <> 0 then
      raise exception 'Invalid price % for player %', v_price, v_player_id;
    end if;

    select * into v_player
    from fantasy_players fp
    where fp.id = v_player_id and fp.active = true and fp.on_current_roster = true;
    if not found then
      raise exception 'Player % is not in the active current roster', v_player_id;
    end if;

    if upper(coalesce(v_row->>'position', v_player.position)) not in ('C','W','D','G') then
      raise exception 'Invalid position for %', v_player.name;
    end if;

    select sp.price into v_old_price
    from fantasy_player_season_prices sp
    where sp.season = p_season and sp.player_id = v_player.id;
    v_old_price := coalesce(v_old_price, v_player.price);

    insert into fantasy_price_publication_rows(
      publication_id, player_id, player_name, team, position, old_price, new_price,
      routing, confidence, source
    ) values (
      v_publication, v_player.id, v_player.name, v_player.team,
      upper(coalesce(v_row->>'position', v_player.position)),
      v_old_price, v_price,
      v_row->>'routing', v_row->>'confidence', v_row->>'source'
    );

    update fantasy_players
    set price = v_price,
        available_for_purchase = case when v_make_available then true else available_for_purchase end,
        updated_at = now()
    where id = v_player.id;

    insert into fantasy_player_season_prices(season, player_id, price, locked_at)
    values(p_season, v_player.id, v_price, now())
    on conflict (season, player_id) do update
      set price = excluded.price,
          locked_at = excluded.locked_at;
  end loop;

  return v_publication;
end;
$$;

revoke all on function publish_fantasy_prices_v462(jsonb,uuid,text,text) from public;
grant execute on function publish_fantasy_prices_v462(jsonb,uuid,text,text) to service_role;
