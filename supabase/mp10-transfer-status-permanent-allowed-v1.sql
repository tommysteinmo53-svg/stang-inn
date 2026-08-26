-- MP-10 transfer optimizer contract repair.
-- Keep get_fantasy_transfer_status_v1 authoritative for whether permanent transfers
-- are allowed. Ordinary/Bytteboost rounds => true; Event Weeks => false.
-- Read-only status function; no fantasy team/transfer data is modified.

drop function if exists public.get_fantasy_transfer_status_v1(text);

create function public.get_fantasy_transfer_status_v1(
  p_season text
)
returns table(
  team_id uuid,
  effective_round_id uuid,
  effective_round_no integer,
  deadline_at timestamptz,
  max_transfers_per_round integer,
  transfers_used integer,
  transfers_remaining integer,
  team_cost numeric,
  permanent_transfers_allowed boolean
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_team uuid;
  v_round fantasy_rounds%rowtype;
  v_limit integer;
  v_used integer;
  v_event boolean := false;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select t.id into v_team
  from fantasy_user_teams t
  where t.user_id=v_user and t.season=p_season;
  if v_team is null then raise exception 'Fantasy team not found for season %',p_season; end if;

  select r.* into v_round
  from fantasy_rounds r
  where r.season=p_season and r.deadline_at>now() and r.round_no<9000
  order by r.deadline_at,r.round_no limit 1;
  if not found then raise exception 'No open fantasy round found for season %',p_season; end if;

  select sr.max_transfers_per_round into v_limit
  from fantasy_season_rules sr where sr.season=p_season;
  if v_limit is null then raise exception 'Fantasy season rules missing for %',p_season; end if;

  select exists(
    select 1 from fantasy_event_weeks ew
    where ew.season=p_season and ew.round_id=v_round.id
  ) into v_event;

  -- Bytteboost is a round-specific override, never a season-rule mutation.
  if not v_event and exists(
    select 1 from fantasy_bonus_activations a
    where a.team_id=v_team
      and a.season=p_season
      and a.round_id=v_round.id
      and a.booster_type='transfer_boost'
      and a.status in ('selected','committed')
  ) then
    v_limit:=4;
  end if;

  select coalesce(sum(b.transfer_count),0)::integer into v_used
  from fantasy_transfer_batches b
  where b.team_id=v_team and b.round_id=v_round.id;

  return query
  select v_team,v_round.id,v_round.round_no,v_round.deadline_at,
         case when v_event then 0 else v_limit end,
         v_used,
         case when v_event then 0 else greatest(v_limit-v_used,0) end,
         coalesce((
           select sum(sp.price)
           from fantasy_user_team_players tp
           join fantasy_player_season_prices sp
             on sp.player_id=tp.player_id and sp.season=p_season
           where tp.team_id=v_team
         ),0)::numeric,
         not v_event;
end;
$$;

revoke all on function public.get_fantasy_transfer_status_v1(text) from public;
revoke all on function public.get_fantasy_transfer_status_v1(text) from anon;
grant execute on function public.get_fantasy_transfer_status_v1(text) to authenticated;

comment on function public.get_fantasy_transfer_status_v1(text) is
  'Authoritative Fantasy transfer status. permanent_transfers_allowed=false only when permanent transfers are blocked (for example Event Weeks).';

notify pgrst,'reload schema';
