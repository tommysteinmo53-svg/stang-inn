-- MP-01.7: harden the shared Stang Inn profile surface after onboarding RPC rollout.

drop policy if exists "Players can edit themselves" on public.players;

revoke insert, update, delete, truncate, references, trigger on table public.players from anon, authenticated;
revoke select on table public.players from anon, authenticated;

-- Competition clients only need safe profile fields. Email stays private in storage.
grant select (id, display_name, avatar, admin, created_at, profile_name_confirmed_at)
  on table public.players to authenticated;

-- Keep the existing authenticated read policy; RLS still applies to table access.
-- Profile creation/name updates happen only through complete_stanginn_profile_v1.
