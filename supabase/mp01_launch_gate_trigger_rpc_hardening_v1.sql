-- MP-01.6 launch gate: trigger functions must not be directly callable by client roles.
-- Revoking EXECUTE does not disable the triggers that reference these functions.

revoke all on function public.capture_fantasy_snapshot_owner_name_v1() from public;
revoke all on function public.capture_fantasy_snapshot_owner_name_v1() from anon;
revoke all on function public.capture_fantasy_snapshot_owner_name_v1() from authenticated;

revoke all on function public.guard_ep_provisional_nif_insert() from public;
revoke all on function public.guard_ep_provisional_nif_insert() from anon;
revoke all on function public.guard_ep_provisional_nif_insert() from authenticated;
