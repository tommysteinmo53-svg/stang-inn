-- Stang Inn Fantasy Hockey – v0.25
-- Monthly winners, form streaks and expert titles.
-- All features are derived from stored fantasy_team_round_points.
-- Test rounds (round_no >= 9000) are excluded.

-- ============================================================
-- 1. MONTHLY LEADERBOARD
-- Month is based on round deadline in Europe/Oslo.
-- Equal monthly points share the same position.
-- ============================================================

drop function if exists get_fantasy_monthly_leaderboard(text);

create function get_fantasy_monthly_leaderboard(
  p_season text
)
returns table(
  month_key text,
  month_start date,
  standings_position bigint,
  team_id uuid,
  user_id uuid,
  team_name text,
  monthly_points numeric,
  rounds_scored bigint,
  round_wins bigint
)
language sql
stable
security definer
set search_path=public
as $$
  with scored as (
    select
      trp.team_id,
      trp.user_id,
      trp.round_id,
      trp.total_points,
      r.deadline_at,
      date_trunc('month', r.deadline_at at time zone 'Europe/Oslo')::date as month_start,
      dense_rank() over(
        partition by trp.round_id
        order by trp.total_points desc
      ) as round_rank
    from fantasy_team_round_points trp
    join fantasy_rounds r on r.id=trp.round_id
    where trp.season=p_season
      and r.season=p_season
      and r.round_no<9000
  ), monthly as (
    select
      s.month_start,
      s.team_id,
      max(s.user_id) as user_id,
      sum(s.total_points)::numeric as monthly_points,
      count(*)::bigint as rounds_scored,
      count(*) filter(where s.round_rank=1)::bigint as round_wins
    from scored s
    group by s.month_start,s.team_id
  ), ranked as (
    select
      m.*,
      dense_rank() over(
        partition by m.month_start
        order by m.monthly_points desc
      ) as standings_position
    from monthly m
  )
  select
    to_char(ranked.month_start,'YYYY-MM') as month_key,
    ranked.month_start,
    ranked.standings_position,
    ranked.team_id,
    ranked.user_id,
    t.name as team_name,
    ranked.monthly_points,
    ranked.rounds_scored,
    ranked.round_wins
  from ranked
  join fantasy_user_teams t on t.id=ranked.team_id
  order by ranked.month_start desc,ranked.standings_position,t.name;
$$;

revoke all on function get_fantasy_monthly_leaderboard(text) from public;
grant execute on function get_fantasy_monthly_leaderboard(text) to authenticated;


-- ============================================================
-- 2. TEAM STREAKS
-- A streak is consecutive scored rounds where the team finishes
-- in the upper half of the scored field for that round.
-- Upper half threshold = ceil(number of scored teams / 2).
-- ============================================================

drop function if exists get_fantasy_team_streaks(text);

create function get_fantasy_team_streaks(
  p_season text
)
returns table(
  team_id uuid,
  user_id uuid,
  team_name text,
  current_streak integer,
  longest_streak integer,
  latest_round_no integer,
  latest_round_position bigint,
  latest_round_field_size bigint,
  latest_round_in_streak boolean
)
language sql
stable
security definer
set search_path=public
as $$
  with round_ranked as (
    select
      trp.team_id,
      trp.user_id,
      trp.round_id,
      r.round_no,
      dense_rank() over(
        partition by trp.round_id
        order by trp.total_points desc
      ) as round_position,
      count(*) over(partition by trp.round_id)::bigint as field_size
    from fantasy_team_round_points trp
    join fantasy_rounds r on r.id=trp.round_id
    where trp.season=p_season
      and r.season=p_season
      and r.round_no<9000
  ), flags as (
    select
      rr.*,
      (rr.round_position <= ceil(rr.field_size::numeric/2.0)) as good_round
    from round_ranked rr
  ), ordered as (
    select
      f.*,
      row_number() over(partition by f.team_id order by f.round_no) as seq_all,
      row_number() over(partition by f.team_id,f.good_round order by f.round_no) as seq_flag
    from flags f
  ), streak_groups as (
    select
      o.*,
      (o.seq_all-o.seq_flag) as grp
    from ordered o
  ), good_lengths as (
    select
      sg.team_id,
      sg.grp,
      count(*)::integer as streak_len,
      max(sg.round_no) as streak_end_round
    from streak_groups sg
    where sg.good_round
    group by sg.team_id,sg.grp
  ), longest as (
    select gl.team_id,max(gl.streak_len)::integer as longest_streak
    from good_lengths gl
    group by gl.team_id
  ), latest as (
    select x.*
    from (
      select
        f.*,
        row_number() over(partition by f.team_id order by f.round_no desc) as rn
      from flags f
    ) x
    where x.rn=1
  ), current_len as (
    select
      l.team_id,
      case
        when not l.good_round then 0
        else coalesce((
          select gl.streak_len
          from good_lengths gl
          where gl.team_id=l.team_id
            and gl.streak_end_round=l.round_no
          limit 1
        ),0)
      end::integer as current_streak
    from latest l
  )
  select
    t.id as team_id,
    t.user_id,
    t.name as team_name,
    coalesce(c.current_streak,0)::integer,
    coalesce(lo.longest_streak,0)::integer,
    l.round_no as latest_round_no,
    l.round_position as latest_round_position,
    l.field_size as latest_round_field_size,
    coalesce(l.good_round,false) as latest_round_in_streak
  from fantasy_user_teams t
  left join latest l on l.team_id=t.id
  left join current_len c on c.team_id=t.id
  left join longest lo on lo.team_id=t.id
  where t.season=p_season
  order by coalesce(c.current_streak,0) desc,coalesce(lo.longest_streak,0) desc,t.name;
$$;

revoke all on function get_fantasy_team_streaks(text) from public;
grant execute on function get_fantasy_team_streaks(text) to authenticated;


-- ============================================================
-- 3. EXPERT TITLES
-- Minimum three scored rounds before competitive titles activate.
-- Titles are based on dense season position relative to field size.
-- ============================================================

drop function if exists get_fantasy_expert_titles(text);

create function get_fantasy_expert_titles(
  p_season text
)
returns table(
  team_id uuid,
  user_id uuid,
  team_name text,
  standings_position bigint,
  field_size bigint,
  rounds_scored bigint,
  total_points numeric,
  expert_title text,
  expert_icon text,
  title_reason text
)
language sql
stable
security definer
set search_path=public
as $$
  with board as (
    select * from get_fantasy_season_leaderboard(p_season)
  ), sized as (
    select b.*,count(*) over()::bigint as field_size
    from board b
  )
  select
    s.team_id,
    s.user_id,
    s.team_name,
    s.standings_position,
    s.field_size,
    s.rounds_scored,
    s.total_points,
    case
      when s.rounds_scored<3 then 'Rookie'
      when s.standings_position=1 then 'Fantasy-ekspert'
      when s.standings_position <= greatest(1,ceil(s.field_size*0.10)::bigint) then 'Taktiker'
      when s.standings_position <= greatest(1,ceil(s.field_size*0.25)::bigint) then 'Analytiker'
      else 'Utfordrer'
    end as expert_title,
    case
      when s.rounds_scored<3 then '🌱'
      when s.standings_position=1 then '👑'
      when s.standings_position <= greatest(1,ceil(s.field_size*0.10)::bigint) then '🧠'
      when s.standings_position <= greatest(1,ceil(s.field_size*0.25)::bigint) then '📈'
      else '🏒'
    end as expert_icon,
    case
      when s.rounds_scored<3 then 'Minst 3 beregnede runder kreves før konkurransetittel.'
      when s.standings_position=1 then 'Leder sesongtabellen.'
      when s.standings_position <= greatest(1,ceil(s.field_size*0.10)::bigint) then 'Topp 10 % av sesongtabellen.'
      when s.standings_position <= greatest(1,ceil(s.field_size*0.25)::bigint) then 'Topp 25 % av sesongtabellen.'
      else 'Aktiv utfordrer i sesongtabellen.'
    end as title_reason
  from sized s
  order by s.standings_position,s.team_name;
$$;

revoke all on function get_fantasy_expert_titles(text) from public;
grant execute on function get_fantasy_expert_titles(text) to authenticated;


-- ============================================================
-- 4. ACHIEVEMENT SUMMARY FOR THE LEADERBOARD PAGE
-- One row per fantasy team combining streak + title.
-- ============================================================

drop function if exists get_fantasy_team_achievements(text);

create function get_fantasy_team_achievements(
  p_season text
)
returns table(
  team_id uuid,
  current_streak integer,
  longest_streak integer,
  expert_title text,
  expert_icon text,
  title_reason text
)
language sql
stable
security definer
set search_path=public
as $$
  select
    e.team_id,
    s.current_streak,
    s.longest_streak,
    e.expert_title,
    e.expert_icon,
    e.title_reason
  from get_fantasy_expert_titles(p_season) e
  join get_fantasy_team_streaks(p_season) s on s.team_id=e.team_id
  order by e.standings_position,e.team_name;
$$;

revoke all on function get_fantasy_team_achievements(text) from public;
grant execute on function get_fantasy_team_achievements(text) to authenticated;
