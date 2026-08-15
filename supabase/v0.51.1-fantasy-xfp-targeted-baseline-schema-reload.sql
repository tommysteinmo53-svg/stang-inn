-- Stang Inn Fantasy Hockey – v0.51.1
-- Force PostgREST/Supabase to refresh its schema cache after v0.51.
-- Safe: does not modify data or xFP logic.

-- Verify that the function exists with the expected RPC signature.
do $$
begin
  if to_regprocedure('public.get_fantasy_xfp_baseline_players_admin_v1(uuid[],text)') is null then
    raise exception 'Missing function public.get_fantasy_xfp_baseline_players_admin_v1(uuid[],text). Run v0.51 first.';
  end if;
end $$;

-- Ask PostgREST to reload database schema metadata/RPC signatures.
notify pgrst, 'reload schema';
