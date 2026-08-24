-- MP-13.5: Use the authenticated user's real name as the public tipping name when available.
-- Existing display_name remains the fallback when auth metadata has no full name.

update public.players p
set display_name = coalesce(
  nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
  nullif(trim(u.raw_user_meta_data->>'name'), ''),
  p.display_name
)
from auth.users u
where u.id = p.id
  and coalesce(
    nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(u.raw_user_meta_data->>'name'), '')
  ) is not null
  and p.display_name is distinct from coalesce(
    nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(u.raw_user_meta_data->>'name'), '')
  );

create or replace function public.mp13_set_player_display_name_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_name text;
begin
  select coalesce(
    nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(u.raw_user_meta_data->>'name'), '')
  )
  into v_name
  from auth.users u
  where u.id = new.id;

  if v_name is not null then
    new.display_name := v_name;
  end if;

  return new;
end;
$$;

revoke all on function public.mp13_set_player_display_name_from_auth() from public, anon, authenticated;

drop trigger if exists mp13_player_display_name_from_auth on public.players;
create trigger mp13_player_display_name_from_auth
before insert on public.players
for each row execute function public.mp13_set_player_display_name_from_auth();
