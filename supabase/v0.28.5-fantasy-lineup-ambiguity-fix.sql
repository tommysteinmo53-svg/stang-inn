-- Stang Inn Fantasy Hockey – v0.28.5
-- Fix PL/pgSQL ambiguity between RETURNS TABLE output variable team_id
-- and fantasy_user_team_players.team_id in set_fantasy_lineup_v1.
-- Safe to run after v0.28.2/v0.28.4.

create or replace function set_fantasy_lineup_v1(
  p_season text,
  p_line1_player_ids uuid[]
) returns table(
  team_id uuid,
  line1_count integer,
  line2_count integer
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_team uuid;
  v_count integer;
  v_distinct integer;
  v_f integer;
  v_d integer;
  v_g integer;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select t.id
  into v_team
  from fantasy_user_teams t
  where t.user_id=v_user
    and t.season=p_season;

  if v_team is null then
    raise exception 'Fantasy team not found for season %',p_season;
  end if;

  v_count := coalesce(array_length(p_line1_player_ids,1),0);
  if v_count <> 6 then
    raise exception 'First line must contain exactly 6 players, got %',v_count;
  end if;

  select count(distinct x)
  into v_distinct
  from unnest(p_line1_player_ids) x;

  if v_distinct <> 6 then
    raise exception 'Duplicate players are not allowed in first line';
  end if;

  if exists (
    select 1
    from unnest(p_line1_player_ids) x
    where not exists (
      select 1
      from fantasy_user_team_players tp
      where tp.team_id=v_team
        and tp.player_id=x
    )
  ) then
    raise exception 'All first-line players must belong to the current fantasy roster';
  end if;

  select
    count(*) filter(where fp.position in ('C','W')),
    count(*) filter(where fp.position='D'),
    count(*) filter(where fp.position='G')
  into v_f,v_d,v_g
  from fantasy_players fp
  where fp.id=any(p_line1_player_ids);

  if v_f<>3 or v_d<>2 or v_g<>1 then
    raise exception 'First line must be 3F/2D/1G, got %F/%D/%G',v_f,v_d,v_g;
  end if;

  update fantasy_user_team_players tp
  set line_no = case when tp.player_id=any(p_line1_player_ids) then 1 else 2 end
  where tp.team_id=v_team;

  return query
  select
    v_team,
    count(*) filter(where tp.line_no=1)::integer,
    count(*) filter(where tp.line_no=2)::integer
  from fantasy_user_team_players tp
  where tp.team_id=v_team;
end;
$$;

revoke all on function set_fantasy_lineup_v1(text,uuid[]) from public;
grant execute on function set_fantasy_lineup_v1(text,uuid[]) to authenticated;

comment on function set_fantasy_lineup_v1(text,uuid[]) is
  'Free lineup reordering between first and second line. Does not consume transfers, change roster membership, or alter fixed player prices.';
