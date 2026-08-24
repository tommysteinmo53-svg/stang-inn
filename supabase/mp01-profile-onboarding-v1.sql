-- MP-01.7: general Stang Inn profile-name onboarding contract.
-- Step 1 is backwards-compatible with the current AuthGate. Direct player writes
-- are hardened in a later step after the app has switched to this RPC.

alter table public.players
  add column if not exists profile_name_confirmed_at timestamptz;

-- Existing users with a sensible stored name are treated as already complete.
-- New profiles remain unconfirmed until they explicitly save/confirm a name.
update public.players
set profile_name_confirmed_at = coalesce(profile_name_confirmed_at, now())
where profile_name_confirmed_at is null
  and length(btrim(display_name)) between 2 and 60;

create or replace function public.complete_stanginn_profile_v1(p_display_name text)
returns table (
  id uuid,
  display_name text,
  profile_name_confirmed_at timestamptz,
  admin boolean
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := regexp_replace(btrim(coalesce(p_display_name, '')), '\s+', ' ', 'g');
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if length(v_name) < 2 then
    raise exception 'Profilnavnet må være minst 2 tegn langt' using errcode = '22023';
  end if;

  if length(v_name) > 60 then
    raise exception 'Profilnavnet kan være maks 60 tegn langt' using errcode = '22023';
  end if;

  if v_name ~ '[[:cntrl:]]' then
    raise exception 'Profilnavnet inneholder ugyldige tegn' using errcode = '22023';
  end if;

  insert into public.players as p (id, display_name, admin, profile_name_confirmed_at)
  values (v_user_id, v_name, false, now())
  on conflict (id) do update
    set display_name = excluded.display_name,
        profile_name_confirmed_at = excluded.profile_name_confirmed_at
  where p.id = v_user_id;

  return query
  select p.id, p.display_name, p.profile_name_confirmed_at, coalesce(p.admin, false)
  from public.players p
  where p.id = v_user_id;
end;
$$;

revoke all on function public.complete_stanginn_profile_v1(text) from public;
revoke all on function public.complete_stanginn_profile_v1(text) from anon;
grant execute on function public.complete_stanginn_profile_v1(text) to authenticated;

comment on column public.players.profile_name_confirmed_at is
  'Set only after the user explicitly confirms/saves their Stang Inn display name.';

comment on function public.complete_stanginn_profile_v1(text) is
  'Authenticated-only profile onboarding/update RPC for the shared Stang Inn display name.';
