-- Stang Inn v0.8b – atomisk lagring av tabelltips
-- Kjør hele filen i Supabase SQL Editor etter v0.8-table-tips.sql.

create or replace function public.save_table_tip_rankings(teams text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Ikke innlogget';
  end if;

  if public.table_tips_is_locked() then
    raise exception 'Tabelltipset er låst';
  end if;

  if coalesce(array_length(teams, 1), 0) <> 10 then
    raise exception 'Tabelltipset må inneholde nøyaktig 10 lag';
  end if;

  if (select count(distinct team) from unnest(teams) as team) <> 10 then
    raise exception 'Hvert lag kan bare brukes én gang';
  end if;

  delete from public.table_tips
  where player_id = uid;

  insert into public.table_tips (player_id, team, position)
  select uid, team, ordinality::integer
  from unnest(teams) with ordinality as ranked(team, ordinality);
end;
$$;

grant execute on function public.save_table_tip_rankings(text[]) to authenticated;
