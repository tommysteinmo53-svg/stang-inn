-- Stang Inn Fantasy Hockey – v0.44.1
-- Fix PL/pgSQL output-column ambiguity in get_fantasy_optimizer_admin_v1().

create or replace function get_fantasy_optimizer_admin_v1(
  p_season text default '2026/27',
  p_horizon text default 'next3',
  p_budget numeric default null
)
returns table(
  player_id uuid,
  player_name text,
  team text,
  player_position text,
  price numeric,
  projected_points numeric,
  total_cost numeric,
  total_projected_points numeric
)
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_budget numeric;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from players p where p.id=auth.uid() and p.admin=true) then raise exception 'Admin only'; end if;
  if p_horizon not in ('next_game','next3') then raise exception 'Unsupported optimizer horizon: %',p_horizon; end if;

  select coalesce(p_budget,r.budget)
  into v_budget
  from fantasy_season_rules r
  where r.season=p_season;

  if v_budget is null then raise exception 'Fantasy season rules missing for %',p_season; end if;

  return query
  with pool as (
    select
      x.player_id,
      x.player_name,
      x.team,
      case when x.player_position in('C','W') then 'F' else x.player_position end as pos,
      x.price,
      case when p_horizon='next_game' then x.xfp_next_game else x.xfp_next3 end::numeric as score
    from get_fantasy_xfp_admin_v1(p_season) x
    join fantasy_players fp on fp.id=x.player_id
    where fp.active=true
      and fp.on_current_roster=true
      and coalesce(fp.available_for_purchase,true)=true
      and x.price is not null
      and x.price>0
  ),
  ranked as (
    select
      p.*,
      row_number() over(partition by p.pos order by p.score desc,p.price asc,p.player_name) as score_rank,
      row_number() over(partition by p.pos order by case when p.price>0 then p.score/p.price else 0 end desc,p.score desc) as value_rank,
      row_number() over(partition by p.pos order by p.price asc,p.score desc) as cheap_rank
    from pool p
  ),
  candidates as (
    select distinct
      r.player_id,
      r.player_name,
      r.team,
      r.pos,
      r.price,
      r.score
    from ranked r
    where r.score_rank<=24
       or r.value_rank<=24
       or r.cheap_rank<=12
  ),
  g_pairs as (
    select
      array[a.player_id,b.player_id] ids,
      a.price+b.price cost,
      a.score+b.score score
    from candidates a
    join candidates b
      on a.pos='G'
      and b.pos='G'
      and a.player_id<b.player_id
  ),
  d_pairs as (
    select
      array[a.player_id,b.player_id] ids,
      a.price+b.price cost,
      a.score+b.score score
    from candidates a
    join candidates b
      on a.pos='D'
      and b.pos='D'
      and a.player_id<b.player_id
  ),
  d_quads as (
    select
      p1.ids||p2.ids ids,
      p1.cost+p2.cost cost,
      p1.score+p2.score score
    from d_pairs p1
    join d_pairs p2 on p1.ids[2]<p2.ids[1]
  ),
  f_triples as (
    select
      array[a.player_id,b.player_id,c.player_id] ids,
      a.price+b.price+c.price cost,
      a.score+b.score+c.score score
    from candidates a
    join candidates b
      on a.pos='F'
      and b.pos='F'
      and a.player_id<b.player_id
    join candidates c
      on c.pos='F'
      and b.player_id<c.player_id
  ),
  f_sixes as (
    select
      p1.ids||p2.ids ids,
      p1.cost+p2.cost cost,
      p1.score+p2.score score
    from f_triples p1
    join f_triples p2 on p1.ids[3]<p2.ids[1]
  ),
  combos as (
    select
      g.ids||d.ids||f.ids ids,
      g.cost+d.cost+f.cost cost,
      g.score+d.score+f.score score
    from g_pairs g
    cross join d_quads d
    cross join f_sixes f
    where g.cost+d.cost+f.cost<=v_budget
    order by g.score+d.score+f.score desc
    limit 5000
  ),
  valid as (
    select c.*
    from combos c
    where not exists(
      select 1
      from candidates p
      where p.player_id=any(c.ids)
      group by p.team
      having count(*)>3
    )
    order by c.score desc,c.cost asc
    limit 1
  ),
  chosen as (
    select
      p.player_id,
      p.player_name,
      p.team,
      p.pos,
      p.price,
      p.score,
      v.cost as total_cost,
      v.score as total_score
    from valid v
    join candidates p on p.player_id=any(v.ids)
  )
  select
    c.player_id,
    c.player_name,
    c.team,
    c.pos,
    c.price,
    round(c.score,2),
    round(c.total_cost,2),
    round(c.total_score,2)
  from chosen c
  order by case c.pos when 'G' then 1 when 'D' then 2 else 3 end,c.score desc;
end;
$$;

revoke all on function get_fantasy_optimizer_admin_v1(text,text,numeric) from public;
grant execute on function get_fantasy_optimizer_admin_v1(text,text,numeric) to authenticated;
