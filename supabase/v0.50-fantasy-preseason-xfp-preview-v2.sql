-- Stang Inn Fantasy Hockey – v0.50
-- PRESEASON xFP V2 PREVIEW
-- Read-only/admin preview. Does NOT change the production xFP model.
-- Blends the existing next-game xFP baseline with the guarded preseason signal.
-- The preseason weight is sample-size limited and fades to zero after configured regular-season games.

create or replace function get_fantasy_preseason_xfp_preview_admin_v2(
  p_season text default '2026/27'
)
returns table(
  player_id uuid,
  player_name text,
  team text,
  player_position text,
  baseline_xfp numeric,
  preseason_ppg numeric,
  preseason_games integer,
  preseason_weight numeric,
  preseason_adjustment numeric,
  preview_xfp numeric,
  avg_opponent_factor numeric,
  avg_data_weight numeric,
  regular_games integer,
  data_confidence text
)
language plpgsql
stable
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists(
    select 1 from players p
    where p.id=auth.uid() and p.admin=true
  ) then
    raise exception 'Admin only';
  end if;

  return query
  with preseason as (
    select *
    from get_fantasy_preseason_signal_admin_v1(p_season)
  ),
  baseline as (
    select *
    from get_fantasy_xfp_admin_v1(p_season)
  )
  select
    ps.player_id,
    ps.player_name,
    ps.team,
    ps.player_position,
    round(coalesce(b.xfp_next_game,0)::numeric,2) as baseline_xfp,
    round(ps.preseason_ppg::numeric,2) as preseason_ppg,
    ps.preseason_games,
    ps.preseason_weight,
    round(((ps.preseason_ppg-coalesce(b.xfp_next_game,0))*ps.preseason_weight)::numeric,2) as preseason_adjustment,
    round((coalesce(b.xfp_next_game,0)*(1-ps.preseason_weight)+ps.preseason_ppg*ps.preseason_weight)::numeric,2) as preview_xfp,
    ps.avg_opponent_factor,
    ps.avg_data_weight,
    ps.regular_games,
    ps.data_confidence
  from preseason ps
  left join baseline b on b.player_id=ps.player_id
  order by preview_xfp desc, ps.player_name;
end;
$$;

revoke all on function get_fantasy_preseason_xfp_preview_admin_v2(text) from public;
grant execute on function get_fantasy_preseason_xfp_preview_admin_v2(text) to authenticated;

comment on function get_fantasy_preseason_xfp_preview_admin_v2(text) is
  'Admin-only read-only preview: existing next-game xFP blended with guarded preseason signal. Does not modify production xFP.';
