-- MP-10 – safe authenticated season-economy input for the end-user optimizer.
-- Read-only, no admin privilege and no user-private data.

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
  if p_season<>'2026/27' then raise exception 'Unsupported fantasy season: %',p_season; end if;

  return query
  select r.season,r.budget,r.economy_lock_at,
    (select min(g.starts_at) from fantasy_games g where g.season=p_season) first_game_at,
    (r.economy_lock_at is not null and now()>=r.economy_lock_at) economy_locked
  from fantasy_season_rules r
  where r.season=p_season;
end;
$$;

revoke all on function public.get_fantasy_economy_v1(text) from public;
revoke all on function public.get_fantasy_economy_v1(text) from anon;
grant execute on function public.get_fantasy_economy_v1(text) to authenticated;
comment on function public.get_fantasy_economy_v1(text) is
  'MP-10 read-only authenticated season economy for end-user optimizer.';

notify pgrst,'reload schema';
