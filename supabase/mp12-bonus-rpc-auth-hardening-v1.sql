-- MP-12.3 / MP-12.7 – authenticated-only hardening for personal Bonus Weeks RPCs.
-- These SECURITY DEFINER functions already enforce auth.uid() internally; this migration
-- narrows the database EXECUTE surface so anon cannot invoke them at all.

revoke all on function public.select_fantasy_booster_v1(text,text,uuid) from public, anon;
revoke all on function public.cancel_fantasy_booster_v1(text,text) from public, anon;
revoke all on function public.get_my_fantasy_boosters_v1(text) from public, anon;

grant execute on function public.select_fantasy_booster_v1(text,text,uuid) to authenticated;
grant execute on function public.cancel_fantasy_booster_v1(text,text) to authenticated;
grant execute on function public.get_my_fantasy_boosters_v1(text) to authenticated;

comment on function public.select_fantasy_booster_v1(text,text,uuid) is
  'MP-07.6C/MP-12: authenticated-only personal booster selection before deadline.';
comment on function public.cancel_fantasy_booster_v1(text,text) is
  'MP-07.6C/MP-12: authenticated-only personal booster cancellation before deadline.';
comment on function public.get_my_fantasy_boosters_v1(text) is
  'MP-07.6C/MP-12: authenticated-only personal booster inventory/status.';
