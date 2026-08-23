-- MP-12.3 / MP-12.7 – production hardening for legacy Fantasy E2E helpers.
-- E2E helpers are operational/test tooling, never player-facing API endpoints.
-- Keep them unavailable to anon/authenticated clients. Trusted operators can still
-- run them from SQL as postgres; service_role is retained only for controlled server tooling.

revoke all on function public.cleanup_fantasy_achievements_e2e_test() from public, anon, authenticated;
revoke all on function public.cleanup_fantasy_leaderboard_e2e_test() from public, anon, authenticated;
revoke all on function public.cleanup_fantasy_scoring_e2e_test(text) from public, anon, authenticated;
revoke all on function public.cleanup_fantasy_snapshot_test_round(text) from public, anon, authenticated;
revoke all on function public.create_fantasy_achievements_e2e_test() from public, anon, authenticated;
revoke all on function public.create_fantasy_leaderboard_e2e_test() from public, anon, authenticated;
revoke all on function public.create_fantasy_scoring_e2e_test(text) from public, anon, authenticated;
revoke all on function public.create_fantasy_snapshot_test_round(text) from public, anon, authenticated;
revoke all on function public.get_fantasy_snapshot_test_state(text) from public, anon, authenticated;
revoke all on function public.run_fantasy_achievements_e2e_test() from public, anon, authenticated;
revoke all on function public.run_fantasy_captain_vice_e2e_test() from public, anon, authenticated;
revoke all on function public.run_fantasy_leaderboard_e2e_test() from public, anon, authenticated;
revoke all on function public.run_fantasy_my_round_details_e2e_test() from public, anon, authenticated;
revoke all on function public.run_fantasy_scoring_e2e_test(text) from public, anon, authenticated;
revoke all on function public.run_fantasy_transfers_e2e_test() from public, anon, authenticated;

grant execute on function public.cleanup_fantasy_achievements_e2e_test() to service_role;
grant execute on function public.cleanup_fantasy_leaderboard_e2e_test() to service_role;
grant execute on function public.cleanup_fantasy_scoring_e2e_test(text) to service_role;
grant execute on function public.cleanup_fantasy_snapshot_test_round(text) to service_role;
grant execute on function public.create_fantasy_achievements_e2e_test() to service_role;
grant execute on function public.create_fantasy_leaderboard_e2e_test() to service_role;
grant execute on function public.create_fantasy_scoring_e2e_test(text) to service_role;
grant execute on function public.create_fantasy_snapshot_test_round(text) to service_role;
grant execute on function public.get_fantasy_snapshot_test_state(text) to service_role;
grant execute on function public.run_fantasy_achievements_e2e_test() to service_role;
grant execute on function public.run_fantasy_captain_vice_e2e_test() to service_role;
grant execute on function public.run_fantasy_leaderboard_e2e_test() to service_role;
grant execute on function public.run_fantasy_my_round_details_e2e_test() to service_role;
grant execute on function public.run_fantasy_scoring_e2e_test(text) to service_role;
grant execute on function public.run_fantasy_transfers_e2e_test() to service_role;
