-- Forward correction for the exact team name observed in the production match feed.
begin;
create or replace function public.is_withdrawn_ehl_team(p_season text, p_team text)
returns boolean language sql immutable security invoker
set search_path = public, pg_temp
as $$
  select coalesce(p_season = '2026/27' and lower(btrim(p_team)) = any(array[
    'sparta', 'sparta elite', 'sparta sarpsborg', 'sparta ishockey elite',
    'sparta ishockey elite, il - ishockey', 'sparta ishockey elite, il - ishockey - men 1'
  ]), false);
$$;
revoke all on function public.is_withdrawn_ehl_team(text,text) from public;
grant execute on function public.is_withdrawn_ehl_team(text,text) to anon, authenticated, service_role;

lock table public.matches, public.fantasy_games, public.fantasy_rounds,
  public.fantasy_team_round_snapshots in share row exclusive mode;
do $correction$
declare
  adjustment_key constant text := 'sparta-withdrawal-2026-27-fixture-alias-v2';
  cfg jsonb;
begin
  if exists(select 1 from public.competition_adjustment_audit where adjustment=adjustment_key and scope='complete') then return; end if;
  select value into cfg from public.app_settings where key='table_tips' for update;
  if cfg->>'season' is distinct from '2026/27' or nullif(cfg->>'deadline','') is null
    or (cfg->>'deadline')::timestamptz<=now() then raise exception 'Fixture correction requires the preseason deadline'; end if;
  if exists(select 1 from public.fantasy_rounds where season='2026/27' and deadline_at<=now())
    or exists(select 1 from public.fantasy_team_round_snapshots where season='2026/27')
    or exists(select 1 from public.matches where season='2026/27' and finished)
    or exists(select 1 from public.fantasy_games where season='2026/27' and status='finished') then
    raise exception 'Season has started: reviewed in-season correction required';
  end if;
  if not exists(select 1 from public.matches where season='2026/27' and
    (home_team='Sparta Ishockey Elite, IL - Ishockey - MEN 1' or away_team='Sparta Ishockey Elite, IL - Ishockey - MEN 1')) then
    raise exception 'Expected verified production Sparta fixture name';
  end if;
  if exists(select 1 from public.tips t join public.matches m on m.id=t.match_id
    where (public.is_withdrawn_ehl_team(m.season,m.home_team) or public.is_withdrawn_ehl_team(m.season,m.away_team))
    and t.points is not null) then raise exception 'Unexpected scored Sparta tips'; end if;

  insert into public.competition_adjustment_audit(adjustment,scope,before_rows)
  select adjustment_key,'matches',coalesce(jsonb_agg(to_jsonb(m)),'[]'::jsonb) from public.matches m
    where public.is_withdrawn_ehl_team(m.season,m.home_team) or public.is_withdrawn_ehl_team(m.season,m.away_team);
  insert into public.competition_adjustment_audit(adjustment,scope,before_rows)
  select adjustment_key,'fantasy_games',coalesce(jsonb_agg(to_jsonb(g)),'[]'::jsonb) from public.fantasy_games g
    where public.is_withdrawn_ehl_team(g.season,g.home_team) or public.is_withdrawn_ehl_team(g.season,g.away_team);
  insert into public.competition_adjustment_audit(adjustment,scope,before_rows)
  select adjustment_key,'fantasy_round_games',coalesce(jsonb_agg(to_jsonb(rg)),'[]'::jsonb) from public.fantasy_round_games rg
    join public.fantasy_games g on g.id=rg.game_id
    where public.is_withdrawn_ehl_team(g.season,g.home_team) or public.is_withdrawn_ehl_team(g.season,g.away_team);

  -- Existing fixture guards clear scores and fantasy-round pointers; no fixture/tip is deleted.
  update public.matches set cancelled=true where season='2026/27'
    and (public.is_withdrawn_ehl_team(season,home_team) or public.is_withdrawn_ehl_team(season,away_team));
  update public.fantasy_games set status='cancelled',updated_at=now() where season='2026/27'
    and (public.is_withdrawn_ehl_team(season,home_team) or public.is_withdrawn_ehl_team(season,away_team));

  -- Verify the actual source name independently of the alias helper.
  if exists(select 1 from public.matches where season='2026/27'
    and (home_team='Sparta Ishockey Elite, IL - Ishockey - MEN 1' or away_team='Sparta Ishockey Elite, IL - Ishockey - MEN 1')
    and (not cancelled or finished or home_score is not null or away_score is not null)) then
    raise exception 'Verified Sparta fixtures were not annulled';
  end if;
  if exists(select 1 from public.fantasy_games where season='2026/27'
    and (home_team='Sparta Ishockey Elite, IL - Ishockey - MEN 1' or away_team='Sparta Ishockey Elite, IL - Ishockey - MEN 1')
    and (status is distinct from 'cancelled' or fantasy_round_id is not null or fantasy_round_no is not null)) then
    raise exception 'Verified Sparta fantasy fixtures remain linked';
  end if;
  if exists(select 1 from public.fantasy_rounds r where r.season='2026/27'
    and not exists(select 1 from public.fantasy_games g where g.fantasy_round_id=r.id and g.status<>'cancelled')) then
    raise exception 'Empty fantasy round requires separate review';
  end if;
  insert into public.competition_adjustment_audit(adjustment,scope,before_rows)
    values(adjustment_key,'complete','{"phase":1,"fixture_alias_corrected":true}'::jsonb);
end;
$correction$;
notify pgrst, 'reload schema';
commit;
