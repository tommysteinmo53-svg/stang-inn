-- Stang Inn XI – MP-07.7B/C
-- Authoritative personal round history starts from frozen snapshots.
-- Scoring and transfer ledger are optional context and never reconstruct a roster.

create or replace function public.get_my_fantasy_round_history_v1(
  p_season text,
  p_round_id uuid default null
) returns table(
  round_id uuid,
  round_no integer,
  round_name text,
  deadline_at timestamptz,
  snapshot_id uuid,
  captured_at timestamptz,
  team_id uuid,
  team_name text,
  squad_value numeric,
  booster_type text,
  event_type text,
  event_budget numeric,
  captain_multiplier_override numeric,
  line2_multiplier_override numeric,
  is_scored boolean,
  team_round_points_id uuid,
  base_points numeric,
  captain_bonus numeric,
  vice_captain_bonus numeric,
  round_points numeric,
  calculated_at timestamptz,
  transfer_count integer,
  transfers jsonb,
  player_id uuid,
  player_name text,
  player_position text,
  player_team text,
  player_price numeric,
  line_no integer,
  is_captain boolean,
  is_vice_captain boolean,
  played boolean,
  games_played integer,
  raw_points numeric,
  line_multiplier numeric,
  role_multiplier numeric,
  multiplier numeric,
  bonus_points numeric,
  player_total_points numeric
)
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  return query
  with transfer_by_round as (
    select
      b.team_id,
      b.round_id,
      sum(b.transfer_count)::integer as transfer_count,
      jsonb_agg(
        jsonb_build_object(
          'batch_id', b.id,
          'created_at', b.created_at,
          'transfer_count', b.transfer_count,
          'before_cost', b.before_cost,
          'after_cost', b.after_cost,
          'outgoing', coalesce((
            select jsonb_agg(jsonb_build_object(
              'player_id', i.player_id,
              'name', p.name,
              'team', p.team,
              'position', p.position,
              'price', i.price
            ) order by p.name)
            from public.fantasy_transfer_items i
            join public.fantasy_players p on p.id=i.player_id
            where i.batch_id=b.id and i.direction='out'
          ), '[]'::jsonb),
          'incoming', coalesce((
            select jsonb_agg(jsonb_build_object(
              'player_id', i.player_id,
              'name', p.name,
              'team', p.team,
              'position', p.position,
              'price', i.price
            ) order by p.name)
            from public.fantasy_transfer_items i
            join public.fantasy_players p on p.id=i.player_id
            where i.batch_id=b.id and i.direction='in'
          ), '[]'::jsonb)
        ) order by b.created_at
      ) as transfers
    from public.fantasy_transfer_batches b
    where b.user_id=v_user
      and b.season=p_season
    group by b.team_id,b.round_id
  )
  select
    r.id,
    r.round_no,
    r.name,
    r.deadline_at,
    s.id,
    s.captured_at,
    s.team_id,
    s.team_name,
    s.squad_value::numeric,
    s.booster_type,
    s.event_type,
    s.event_budget::numeric,
    s.captain_multiplier_override::numeric,
    s.line2_multiplier_override::numeric,
    trp.id is not null,
    trp.id,
    trp.base_points::numeric,
    trp.captain_bonus::numeric,
    trp.vice_captain_bonus::numeric,
    trp.total_points::numeric,
    trp.calculated_at,
    case when s.event_type is null then coalesce(tbr.transfer_count,0) else 0 end,
    case when s.event_type is null then coalesce(tbr.transfers,'[]'::jsonb) else '[]'::jsonb end,
    sp.player_id,
    sp.player_name,
    sp.position,
    sp.team,
    sp.price::numeric,
    sp.line_no::integer,
    sp.is_captain,
    sp.is_vice_captain,
    prp.played,
    prp.games_played,
    prp.raw_points::numeric,
    prp.line_multiplier::numeric,
    case
      when prp.id is null then null::numeric
      when coalesce(prp.line_multiplier,1.00)=0 then 1.00::numeric
      else round(prp.multiplier/coalesce(prp.line_multiplier,1.00),3)::numeric
    end,
    prp.multiplier::numeric,
    prp.bonus_points::numeric,
    prp.total_points::numeric
  from public.fantasy_team_round_snapshots s
  join public.fantasy_rounds r on r.id=s.round_id
  join public.fantasy_team_round_snapshot_players sp on sp.snapshot_id=s.id
  left join public.fantasy_team_round_points trp
    on trp.snapshot_id=s.id
  left join public.fantasy_team_round_player_points prp
    on prp.team_round_points_id=trp.id
   and prp.player_id=sp.player_id
  left join transfer_by_round tbr
    on tbr.team_id=s.team_id
   and tbr.round_id=s.round_id
  where s.user_id=v_user
    and s.season=p_season
    and r.season=p_season
    and r.round_no<9000
    and (p_round_id is null or r.id=p_round_id)
  order by
    r.round_no desc,
    sp.line_no,
    case when sp.position='G' then 0 when sp.position='D' then 1 else 2 end,
    sp.player_name;
end;
$$;

revoke all on function public.get_my_fantasy_round_history_v1(text,uuid) from public;
grant execute on function public.get_my_fantasy_round_history_v1(text,uuid) to authenticated;

comment on function public.get_my_fantasy_round_history_v1(text,uuid) is
  'MP-07.7 authoritative personal round history. Roster/lineup/C/VC/name/price come only from the immutable deadline snapshot; score and permanent-transfer ledger are left-joined context.';
