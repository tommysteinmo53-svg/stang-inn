-- MP-03.7 – fixed fantasy prices for EHL 2026/27.
-- Policy: published season prices are fixed for the entire season.
-- After the first scheduled 2026/27 EHL game starts, existing season-price rows
-- cannot be repriced or deleted, including through service-role/admin paths.
-- New players may receive one initial season price after season start; that row is
-- then subject to the same immutable-price rule.
-- Transfer/budget logic must continue to use fantasy_player_season_prices.

create or replace function fantasy_2026_27_has_started()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    now() >= (
      select min(g.starts_at)
      from fantasy_games g
      where g.season = '2026/27'
        and coalesce(g.status,'scheduled') <> 'cancelled'
    ),
    false
  );
$$;

revoke all on function fantasy_2026_27_has_started() from public;
grant execute on function fantasy_2026_27_has_started() to authenticated, service_role;

create or replace function guard_fixed_fantasy_season_price_2026_27()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if old.season = '2026/27'
       and fantasy_2026_27_has_started()
       and (
         new.season is distinct from old.season
         or new.player_id is distinct from old.player_id
         or new.price is distinct from old.price
       ) then
      raise exception '2026/27 fantasy prices are fixed after season start; existing season prices cannot be changed';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.season = '2026/27'
       and fantasy_2026_27_has_started() then
      raise exception '2026/27 fantasy prices are fixed after season start; season prices cannot be deleted';
    end if;
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_fixed_fantasy_season_price_2026_27
  on fantasy_player_season_prices;
create trigger trg_fixed_fantasy_season_price_2026_27
before update or delete on fantasy_player_season_prices
for each row execute function guard_fixed_fantasy_season_price_2026_27();

-- Keep the generic player-price mirror from diverging from an already locked
-- 2026/27 season price after season start. This prevents legacy/admin code that
-- still writes fantasy_players.price from presenting a different 2026/27 value.
create or replace function guard_fantasy_player_price_mirror_2026_27()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_locked_price numeric;
begin
  if new.price is not distinct from old.price
     or not fantasy_2026_27_has_started() then
    return new;
  end if;

  select sp.price
    into v_locked_price
  from fantasy_player_season_prices sp
  where sp.season = '2026/27'
    and sp.player_id = old.id;

  if found and new.price is distinct from v_locked_price then
    raise exception '2026/27 fantasy price is fixed at %m for player %', v_locked_price, old.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_fantasy_player_price_mirror_2026_27
  on fantasy_players;
create trigger trg_fantasy_player_price_mirror_2026_27
before update of price on fantasy_players
for each row execute function guard_fantasy_player_price_mirror_2026_27();

comment on table fantasy_player_season_prices is
  'Authoritative fixed fantasy prices by season. For 2026/27, existing player prices are immutable after the first scheduled EHL game starts; transfers, sales and team value use this table.';

comment on function guard_fixed_fantasy_season_price_2026_27() is
  'MP-03.7 database gate: blocks repricing/deleting existing 2026/27 season prices after season start, including service-role/admin writes.';
