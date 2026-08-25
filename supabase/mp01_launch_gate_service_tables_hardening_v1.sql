-- MP-01.6 launch gate: tables with RLS enabled and intentionally no client policies
-- are service-only. Remove redundant direct privileges from client roles as defense in depth.

revoke all on table public.fantasy_availability_findings from anon, authenticated;
revoke all on table public.fantasy_availability_notification_deliveries from anon, authenticated;
revoke all on table public.fantasy_games from anon, authenticated;
revoke all on table public.fantasy_player_availability from anon, authenticated;
revoke all on table public.fantasy_player_availability_history from anon, authenticated;
revoke all on table public.fantasy_player_game_stats from anon, authenticated;
revoke all on table public.fantasy_player_points from anon, authenticated;
revoke all on table public.fantasy_private_league_members from anon, authenticated;
revoke all on table public.fantasy_private_leagues from anon, authenticated;
revoke all on table public.fantasy_recommendations from anon, authenticated;
revoke all on table public.fantasy_scoring_rules from anon, authenticated;
revoke all on table public.fantasy_snapshot_batches from anon, authenticated;
revoke all on table public.fantasy_stat_snapshots from anon, authenticated;
revoke all on table public.fantasy_xfp_settings from anon, authenticated;
revoke all on table public.hockeytips_private_league_members from anon, authenticated;
revoke all on table public.hockeytips_private_leagues from anon, authenticated;
revoke all on table public.stang_inn_private_league_members from anon, authenticated;
revoke all on table public.stang_inn_private_league_migration_audit from anon, authenticated;
revoke all on table public.stang_inn_private_leagues from anon, authenticated;
