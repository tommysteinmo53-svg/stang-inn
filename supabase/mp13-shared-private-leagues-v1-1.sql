-- MP-13.6 follow-up: repair PL/pgSQL ambiguity discovered by rollback-only behavioral verification.
create or replace function public.join_stang_inn_private_league_v1(p_season text,p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  uid uuid := auth.uid();
  v_league_id uuid;
  clean_code text := upper(btrim(coalesce(p_invite_code,'')));
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if clean_code='' then raise exception 'Invitasjonskode mangler'; end if;

  select l.id into v_league_id
  from public.stang_inn_private_leagues l
  where l.season=p_season and l.invite_code=clean_code;

  if v_league_id is null then raise exception 'Fant ingen miniliga med denne koden'; end if;

  insert into public.stang_inn_private_league_members(league_id,user_id,role)
  values (v_league_id,uid,'member')
  on conflict (league_id,user_id) do nothing;

  return v_league_id;
end;
$$;

revoke all on function public.join_stang_inn_private_league_v1(text,text) from public;
revoke all on function public.join_stang_inn_private_league_v1(text,text) from anon;
grant execute on function public.join_stang_inn_private_league_v1(text,text) to authenticated;
