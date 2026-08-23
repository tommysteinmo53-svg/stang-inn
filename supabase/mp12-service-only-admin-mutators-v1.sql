-- MP-12.3 / MP-12.7 – lock legacy Fantasy admin mutators behind server/service role.
-- The corresponding Next.js admin routes authenticate the caller and verify players.admin
-- before invoking these RPCs with SUPABASE_SECRET_KEY. Direct client execution is unnecessary
-- and unsafe because several legacy functions accept p_admin as an argument.

revoke all on function public.approve_fantasy_player_price_v1(uuid,uuid,numeric,text) from public, anon, authenticated;
revoke all on function public.publish_fantasy_prices_v461(jsonb,uuid,text,text) from public, anon, authenticated;
revoke all on function public.publish_fantasy_prices_v462(jsonb,uuid,text,text) from public, anon, authenticated;
revoke all on function public.reject_fantasy_player_queue_v1(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.set_fantasy_player_price_suggestion_v1(uuid,numeric,text,text,jsonb,boolean) from public, anon, authenticated;
revoke all on function public.sync_fantasy_roster_2026(jsonb,uuid,uuid,uuid) from public, anon, authenticated;

grant execute on function public.approve_fantasy_player_price_v1(uuid,uuid,numeric,text) to service_role;
grant execute on function public.publish_fantasy_prices_v461(jsonb,uuid,text,text) to service_role;
grant execute on function public.publish_fantasy_prices_v462(jsonb,uuid,text,text) to service_role;
grant execute on function public.reject_fantasy_player_queue_v1(uuid,uuid,text) to service_role;
grant execute on function public.set_fantasy_player_price_suggestion_v1(uuid,numeric,text,text,jsonb,boolean) to service_role;
grant execute on function public.sync_fantasy_roster_2026(jsonb,uuid,uuid,uuid) to service_role;
