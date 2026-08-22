-- Stang Inn Fantasy Hockey – v0.66
-- Disable/decommission preseason fantasy-point analysis.
--
-- Decision: training-match statistics are too incomplete and inconsistent to be
-- a trustworthy xFP input. Historical preseason tables/data are deliberately
-- retained for audit/rollback, but they are no longer an active analysis source.
-- Ordinary xFP from historical/regular-season data is NOT changed here.

-- Make any retained configuration inert before removing the admin signal RPC.
do $$
begin
  if to_regclass('public.fantasy_preseason_settings') is not null then
    update public.fantasy_preseason_settings
       set max_weight = 0,
           updated_at = now()
     where max_weight <> 0;
  end if;
end
$$;

-- Remove the training-game analysis surface from the database API.
drop function if exists public.get_fantasy_preseason_xfp_preview_admin_v2(text);
drop function if exists public.get_fantasy_preseason_signal_admin_v1(text);

comment on table public.fantasy_preseason_games is
  'Historical/inert preseason game data retained for audit only. Not used for Fantasy scoring or xFP.';

comment on table public.fantasy_preseason_player_stats is
  'Historical/inert preseason player statistics retained for audit only. Not used for Fantasy scoring or xFP.';
