-- MP-12 – fix Event Week upsert ambiguity discovered by isolated behavioral E2E.
-- The RETURNS TABLE output column `event_type` is also a table column, so
-- ON CONFLICT(season,event_type) is ambiguous inside PL/pgSQL. Target the
-- existing unique constraint explicitly instead.

create or replace function public.configure_fantasy_event_week_v1(
  p_season text,
  p_event_type text,
  p_round_id uuid,
  p_publish boolean default false
) returns table(
  event_week_id uuid,
  event_type text,
  event_budget numeric,
  round_id uuid,
  round_no integer,
  deadline_at timestamptz,
  is_published boolean
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_round fantasy_rounds%rowtype;
  v_budget numeric(10,2);
  v_id uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from players p where p.id=v_user and coalesce(p.admin,false)) then
    raise exception 'Admin access required';
  end if;
  if p_event_type not in ('rich_uncle','poor_uncle') then
    raise exception 'Unsupported Event Week type: %',p_event_type;
  end if;

  select * into v_round
  from fantasy_rounds r
  where r.id=p_round_id and r.season=p_season and r.round_no<9000;
  if not found then raise exception 'Fantasy round not found for season %',p_season; end if;
  if now()>=v_round.deadline_at then raise exception 'Cannot configure an Event Week after round deadline'; end if;

  v_budget := case when p_event_type='rich_uncle' then 200.00 else 70.00 end;

  -- Never move an event after users have started building an event team.
  if exists(
    select 1
    from fantasy_event_weeks ew
    join fantasy_event_teams et on et.event_week_id=ew.id
    where ew.season=p_season and ew.event_type=p_event_type
  ) then
    if exists(
      select 1 from fantasy_event_weeks ew
      where ew.season=p_season and ew.event_type=p_event_type and ew.round_id<>p_round_id
    ) then
      raise exception 'Event Week cannot be moved after event teams exist';
    end if;
  end if;

  if exists(
    select 1 from fantasy_bonus_activations a
    join fantasy_user_teams t on t.id=a.team_id
    where t.season=p_season
      and a.round_id=p_round_id
      and a.status in ('selected','committed','used')
  ) then
    raise exception 'Cannot configure Event Week on a round that already has personal booster selections';
  end if;

  insert into fantasy_event_weeks(season,round_id,event_type,event_budget,is_published,updated_at)
  values(p_season,p_round_id,p_event_type,v_budget,p_publish,now())
  on conflict on constraint fantasy_event_weeks_season_event_type_key do update set
    round_id=excluded.round_id,
    event_budget=excluded.event_budget,
    is_published=excluded.is_published,
    updated_at=now()
  returning id into v_id;

  return query
  select v_id,p_event_type,v_budget::numeric,v_round.id,v_round.round_no,v_round.deadline_at,p_publish;
end;
$$;

revoke all on function public.configure_fantasy_event_week_v1(text,text,uuid,boolean) from public,anon;
grant execute on function public.configure_fantasy_event_week_v1(text,text,uuid,boolean) to authenticated,service_role;
