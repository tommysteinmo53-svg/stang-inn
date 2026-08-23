-- Stang Inn XI – MP-04.5/MP-04.6
-- Read-only authenticated transfer history for the current user's permanent team.

create or replace function get_my_fantasy_transfer_history_v1(p_season text)
returns table(
  batch_id uuid,
  round_no integer,
  created_at timestamptz,
  transfer_count integer,
  before_cost numeric,
  after_cost numeric,
  outgoing jsonb,
  incoming jsonb
)
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_team uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select t.id into v_team
  from fantasy_user_teams t
  where t.user_id=v_user and t.season=p_season;

  if v_team is null then
    return;
  end if;

  return query
  select
    b.id,
    r.round_no,
    b.created_at,
    b.transfer_count,
    b.before_cost,
    b.after_cost,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'player_id',i.player_id,
        'name',p.name,
        'team',p.team,
        'position',p.position,
        'price',i.price
      ) order by p.name)
      from fantasy_transfer_items i
      join fantasy_players p on p.id=i.player_id
      where i.batch_id=b.id and i.direction='out'
    ),'[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'player_id',i.player_id,
        'name',p.name,
        'team',p.team,
        'position',p.position,
        'price',i.price
      ) order by p.name)
      from fantasy_transfer_items i
      join fantasy_players p on p.id=i.player_id
      where i.batch_id=b.id and i.direction='in'
    ),'[]'::jsonb)
  from fantasy_transfer_batches b
  join fantasy_rounds r on r.id=b.round_id
  where b.team_id=v_team and b.user_id=v_user and b.season=p_season
  order by r.round_no desc,b.created_at desc;
end;
$$;

revoke all on function get_my_fantasy_transfer_history_v1(text) from public;
grant execute on function get_my_fantasy_transfer_history_v1(text) to authenticated;

comment on function get_my_fantasy_transfer_history_v1(text) is
  'MP-04.5 read-only transfer history for the authenticated user permanent fantasy team. Event teams are physically separate and never included.';