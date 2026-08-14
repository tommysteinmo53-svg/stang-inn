-- Stang Inn Fantasy Hockey – v0.15
-- Flexible forwards: C and W share six forward slots.
-- Faceoff foundation: track wins/taken and keep scoring disabled (0) until configured.

alter table fantasy_player_game_stats
  add column if not exists faceoffs_won integer not null default 0,
  add column if not exists faceoffs_taken integer not null default 0;

insert into fantasy_scoring_rules(season,key,points,position,active)
values
  ('2026/27','faceoff_win_points',0,null,true),
  ('2026/27','faceoff_win_bonus',0,null,true)
on conflict (season,key,position)
do update set points=excluded.points,active=excluded.active;

comment on column fantasy_player_game_stats.faceoffs_won is
  'Number of faceoffs won by the player in the game.';
comment on column fantasy_player_game_stats.faceoffs_taken is
  'Number of faceoffs taken by the player in the game.';

create or replace function save_fantasy_team_v3(
  p_season text,
  p_name text,
  p_player_ids uuid[],
  p_captain uuid,
  p_vice_captain uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_team uuid;
  v_count integer;
  v_f integer;
  v_d integer;
  v_g integer;
  v_total numeric;
  v_distinct integer;
  v_max_club integer;
  v_club text;
  v_club_count integer;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_season <> '2026/27' then raise exception 'Unsupported fantasy season: %',p_season; end if;

  select max_players_per_club into v_max_club
  from fantasy_season_rules where season=p_season;
  if v_max_club is null then raise exception 'Fantasy rules missing for season %',p_season; end if;

  v_count := coalesce(array_length(p_player_ids,1),0);
  if v_count <> 12 then raise exception 'Team must contain exactly 12 players, got %',v_count; end if;

  select count(distinct x) into v_distinct from unnest(p_player_ids) x;
  if v_distinct <> 12 then raise exception 'Duplicate players are not allowed'; end if;

  if p_captain is null or p_vice_captain is null then raise exception 'Captain and vice-captain are required'; end if;
  if p_captain = p_vice_captain then raise exception 'Captain and vice-captain must be different players'; end if;
  if not (p_captain = any(p_player_ids)) or not (p_vice_captain = any(p_player_ids)) then
    raise exception 'Captain and vice-captain must belong to the selected roster';
  end if;

  select
    count(*) filter (where fp.position in ('C','W')),
    count(*) filter (where fp.position='D'),
    count(*) filter (where fp.position='G'),
    coalesce(sum(fp.price),0)
  into v_f,v_d,v_g,v_total
  from fantasy_players fp
  where fp.id=any(p_player_ids) and fp.price is not null;

  if (v_f+v_d+v_g) <> 12 then raise exception 'One or more selected players are missing or have no published price'; end if;
  if v_f<>6 or v_d<>4 or v_g<>2 then
    raise exception 'Invalid roster: expected 6F/4D/2G, got %F/%D/%G',v_f,v_d,v_g;
  end if;
  if v_total > 100.00 then raise exception 'Budget exceeded: %m > 100.0m',v_total; end if;

  select fp.team,count(*) into v_club,v_club_count
  from fantasy_players fp
  where fp.id=any(p_player_ids)
  group by fp.team
  having count(*) > v_max_club
  order by count(*) desc
  limit 1;
  if v_club is not null then raise exception 'Too many players from %: % selected, maximum is %',v_club,v_club_count,v_max_club; end if;

  insert into fantasy_user_teams(user_id,season,name,budget,updated_at)
  values(v_user,p_season,coalesce(nullif(trim(p_name),''),'Mitt lag'),100.00,now())
  on conflict(user_id,season) do update
    set name=excluded.name,budget=excluded.budget,updated_at=now()
  returning id into v_team;

  delete from fantasy_user_team_players where team_id=v_team;
  insert into fantasy_user_team_players(team_id,player_id,purchase_price,is_captain,is_vice_captain)
  select v_team,fp.id,fp.price,(fp.id=p_captain),(fp.id=p_vice_captain)
  from fantasy_players fp where fp.id=any(p_player_ids);

  return v_team;
end;
$$;

revoke all on function save_fantasy_team_v3(text,text,uuid[],uuid,uuid) from public;
grant execute on function save_fantasy_team_v3(text,text,uuid[],uuid,uuid) to authenticated;
