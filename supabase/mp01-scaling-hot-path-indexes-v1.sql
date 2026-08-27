-- MP-01 scaling readiness: targeted indexes for current production hot paths.
-- No application/session data is modified.

create index if not exists tips_match_id_idx on public.tips(match_id);
create index if not exists table_predictions_player_id_idx on public.table_predictions(player_id);
create index if not exists fantasy_user_team_players_player_id_idx on public.fantasy_user_team_players(player_id);
create index if not exists fantasy_team_round_points_team_id_idx on public.fantasy_team_round_points(team_id);
create index if not exists fantasy_team_round_player_points_player_id_idx on public.fantasy_team_round_player_points(player_id);
create index if not exists fantasy_team_round_player_points_round_id_idx on public.fantasy_team_round_player_points(round_id);
create index if not exists fantasy_team_round_player_points_team_id_idx on public.fantasy_team_round_player_points(team_id);
create index if not exists fantasy_team_round_snapshot_players_player_id_idx on public.fantasy_team_round_snapshot_players(player_id);
create index if not exists fantasy_team_round_snapshots_team_id_idx on public.fantasy_team_round_snapshots(team_id);
create index if not exists stang_inn_private_league_members_user_id_idx on public.stang_inn_private_league_members(user_id);
create index if not exists matches_finished_match_time_idx on public.matches(finished, match_time);
create index if not exists players_active_display_name_idx on public.players(display_name, id) where deactivated_at is null;
