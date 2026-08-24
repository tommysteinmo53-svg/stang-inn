-- MP-07.10 explicit Supabase anon hardening.
revoke execute on function public.get_fantasy_competition_table_v2(text) from anon;
revoke execute on function public.get_fantasy_round_leaderboard_v2(uuid) from anon;
revoke execute on function public.get_fantasy_monthly_leaderboard_v2(text) from anon;
revoke execute on function public.get_fantasy_team_season_history_v3(uuid,text) from anon;

grant execute on function public.get_fantasy_competition_table_v2(text) to authenticated;
grant execute on function public.get_fantasy_round_leaderboard_v2(uuid) to authenticated;
grant execute on function public.get_fantasy_monthly_leaderboard_v2(text) to authenticated;
grant execute on function public.get_fantasy_team_season_history_v3(uuid,text) to authenticated;
