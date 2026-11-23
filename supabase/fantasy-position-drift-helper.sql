-- Resolve fantasy positions from the latest earlier frozen round when available.
-- This prevents provider position drift from invalidating existing rosters.
create or replace function public.fantasy_position_at_round_v1(
  p_team_id uuid, p_player_id uuid, p_round_id uuid
) returns text
language sql stable
set search_path = public
as $$
  select coalesce(
    (
      select sp.position
      from public.fantasy_team_round_snapshot_players sp
      join public.fantasy_team_round_snapshots s on s.id = sp.snapshot_id
      join public.fantasy_rounds old_round on old_round.id = s.round_id
      where s.team_id = p_team_id
        and sp.player_id = p_player_id
        and old_round.deadline_at < (
          select deadline_at from public.fantasy_rounds where id = p_round_id
        )
      order by old_round.deadline_at desc
      limit 1
    ),
    (select position from public.fantasy_players where id = p_player_id)
  );
$$;
