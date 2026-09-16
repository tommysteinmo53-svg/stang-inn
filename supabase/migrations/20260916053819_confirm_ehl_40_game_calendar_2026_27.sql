-- Final 40-game format confirmed by the product owner; published HockeyLive fixtures verified.
begin;
lock table public.matches,public.fantasy_games,public.fantasy_rounds,
  public.fantasy_team_round_snapshots,public.fantasy_event_weeks in share row exclusive mode;
do $confirmation$
declare
  adjustment_key constant text := 'ehl-2026-27-final-40-game-calendar';
  first_game timestamptz; old_deadline timestamptz; cfg jsonb;
begin
  if exists(select 1 from public.competition_adjustment_audit where adjustment=adjustment_key and scope='complete') then return; end if;
  select value into cfg from public.app_settings where key='table_tips' for update;
  select min(deadline_at) into old_deadline from public.fantasy_rounds where season='2026/27';
  select min(match_time) into first_game from public.matches where season='2026/27' and not cancelled;
  if cfg->>'season' is distinct from '2026/27' or (cfg->>'deadline')::timestamptz is distinct from old_deadline
    or old_deadline is null or old_deadline<=now() or first_game<=now()
    or exists(select 1 from public.fantasy_team_round_snapshots where season='2026/27') then
    raise exception 'Calendar confirmation requires untouched preseason deadlines and no snapshots';
  end if;
  if (select count(*) from public.matches where season='2026/27' and not cancelled)<>180
    or exists(select 1 from public.matches where season='2026/27' and not cancelled
      and (match_time is null or finished or home_team=away_team or public.is_withdrawn_ehl_team(season,home_team) or public.is_withdrawn_ehl_team(season,away_team))) then
    raise exception 'Expected 180 valid, unplayed non-Sparta fixtures';
  end if;
  if (select count(distinct team) from (
    select home_team team from public.matches where season='2026/27' and not cancelled
    union all select away_team from public.matches where season='2026/27' and not cancelled) c)<>9
    or exists(select 1 from (
      select home_team team from public.matches where season='2026/27' and not cancelled
      union all select away_team from public.matches where season='2026/27' and not cancelled) c
      group by team having count(*)<>40)
    or exists(select 1 from public.matches where season='2026/27' and not cancelled
      group by least(home_team,away_team),greatest(home_team,away_team) having count(*)<>5) then
    raise exception 'Expected nine clubs, 40 games each and five meetings per pair';
  end if;
  if (select count(*) from public.fantasy_games where season='2026/27' and status<>'cancelled')<>180
    or exists(select 1 from public.matches m left join public.fantasy_games g on g.external_id=m.external_id
      left join public.fantasy_rounds r on r.id=g.fantasy_round_id
      where m.season='2026/27' and not m.cancelled and
      (g.id is null or g.season is distinct from m.season or g.status is distinct from 'scheduled'
       or g.starts_at is distinct from m.match_time or g.home_team is distinct from m.home_team or g.away_team is distinct from m.away_team
       or r.id is null or r.season is distinct from m.season or g.fantasy_round_no is distinct from r.round_no
       or g.starts_at<r.starts_at or g.starts_at>r.ends_at)) then
    raise exception 'Tipping and Fantasy schedules or round windows disagree';
  end if;
  if (select count(*) from public.fantasy_rounds where season='2026/27')<>45
    or exists(select 1 from public.fantasy_rounds r where r.season='2026/27' and
      (r.status<>'open' or not exists(select 1 from public.fantasy_games g where g.fantasy_round_id=r.id and g.status<>'cancelled'))) then
    raise exception 'Expected 45 open, nonempty Fantasy rounds';
  end if;

  insert into public.competition_adjustment_audit(adjustment,scope,before_rows)
    select adjustment_key,'rounds',jsonb_agg(to_jsonb(r)) from public.fantasy_rounds r where season='2026/27';
  insert into public.competition_adjustment_audit(adjustment,scope,before_rows)
    select adjustment_key,'settings',jsonb_agg(to_jsonb(s)) from public.app_settings s where key in('table_tips','ehl_2026_27_format');
  insert into public.competition_adjustment_audit(adjustment,scope,before_rows)
    select adjustment_key,'event_weeks',coalesce(jsonb_agg(to_jsonb(e)),'[]'::jsonb) from public.fantasy_event_weeks e where season='2026/27';

  -- Keep IDs, round membership, end dates and published events. Only align changed deadlines.
  update public.fantasy_rounds r set starts_at=f.first_game,deadline_at=f.first_game,updated_at=now()
  from (select fantasy_round_id,min(starts_at) first_game from public.fantasy_games
    where season='2026/27' and status<>'cancelled' group by fantasy_round_id) f
  where r.id=f.fantasy_round_id and r.season='2026/27'
    and (r.deadline_at is distinct from f.first_game or r.starts_at is distinct from f.first_game);
  update public.app_settings set value=jsonb_set(value,'{deadline}',to_jsonb(first_game)) where key='table_tips';
  insert into public.app_settings(key,value) values('ehl_2026_27_format',jsonb_build_object(
    'status','confirmed','games_per_team',40,'total_games',180,'team_count',9,'meetings_per_pair',5,
    'fantasy_rounds',45,'calendar_provisional',false,'confirmed_at',now(),
    'source','https://sf34-terminlister-prod-app.azurewebsites.net/ta/TournamentMatches/?tournamentId=448981'))
    on conflict(key) do update set value=excluded.value;
  insert into public.competition_adjustment_audit(adjustment,scope,before_rows)
    values(adjustment_key,'complete','{"games_per_team":40,"total_games":180,"fantasy_rounds":45}'::jsonb);
end;
$confirmation$;
notify pgrst,'reload schema';
commit;
