-- MP-10 – admin-only hardening after removal of the end-user optimizer surface.
-- The optimizer remains available only from Admin → Analyse → Optimalisator.

create or replace function public.get_fantasy_xfp_round_horizons_v1(
  p_season text default '2026/27'
)
returns table(
  player_id uuid,
  player_name text,
  team text,
  player_position text,
  price numeric,
  data_confidence text,
  next_round_no integer,
  next_round_name text,
  next_round_games integer,
  next3_round_games integer,
  base_xfp_next_game numeric,
  base_xfp_next_round numeric,
  base_xfp_next3_rounds numeric
)
language plpgsql
stable
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from public.players p where p.id=auth.uid() and p.admin=true) then
    raise exception 'Admin only';
  end if;

  return query
  select
    x.player_id,x.player_name,x.team,x.player_position,x.price,x.data_confidence,
    x.next_round_no,x.next_round_name,x.next_round_games,x.next3_round_games,
    x.base_xfp_next_game,x.base_xfp_next_round,x.base_xfp_next3_rounds
  from public.get_fantasy_xfp_round_horizons_admin_v2(p_season) x;
end;
$$;

create or replace function public.get_fantasy_economy_v1(
  p_season text default '2026/27'
)
returns table(
  season text,
  budget numeric,
  economy_lock_at timestamptz,
  first_game_at timestamptz,
  economy_locked boolean
)
language plpgsql
stable
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from public.players p where p.id=auth.uid() and p.admin=true) then
    raise exception 'Admin only';
  end if;

  return query
  select e.season,e.budget,e.economy_lock_at,e.first_game_at,e.economy_locked
  from public.get_fantasy_economy_admin_v1(p_season) e;
end;
$$;

revoke all on function public.get_fantasy_xfp_round_horizons_v1(text) from public, anon;
revoke all on function public.get_fantasy_economy_v1(text) from public, anon;
grant execute on function public.get_fantasy_xfp_round_horizons_v1(text) to authenticated;
grant execute on function public.get_fantasy_economy_v1(text) to authenticated;

comment on function public.get_fantasy_xfp_round_horizons_v1(text) is 'MP-10 admin-only compatibility RPC for optimizer xFP input.';
comment on function public.get_fantasy_economy_v1(text) is 'MP-10 admin-only compatibility RPC for optimizer economy input.';

notify pgrst,'reload schema';
