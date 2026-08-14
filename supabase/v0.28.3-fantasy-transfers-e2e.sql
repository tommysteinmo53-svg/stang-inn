-- Stang Inn Fantasy Hockey – v0.28.3
-- Isolated E2E for transfers, fixed prices and free line changes.
-- Uses only synthetic players/team and a temporary round, and cleans up after itself.

create or replace function run_fantasy_transfers_e2e_test()
returns table(
  check_no integer,
  check_name text,
  passed boolean,
  detail text
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := '00000000-0000-0000-0000-000000028003';
  v_team uuid;
  v_round uuid;
  v_players uuid[];
  v_roster uuid[];
  v_line1 uuid[];
  v_captain uuid;
  v_vice uuid;
  v_in1 uuid;
  v_in2 uuid;
  v_in3 uuid;
  v_out1 uuid;
  v_out2 uuid;
  v_out3 uuid;
  v_result record;
  v_line record;
  v_limit_blocked boolean := false;
  v_limit_error text := '';
  v_batches_before integer;
  v_batches_after_line integer;
  v_transfer_items integer;
  v_locked_price numeric;
  v_live_price numeric;
  v_team_cost numeric;
  v_rounds_before integer;
  v_games_before integer;
  v_rounds_after integer;
  v_games_after integer;
  v_real_team_rows_before integer;
  v_real_team_rows_after integer;
  i integer;
  v_pos text;
  v_name text;
  v_pid uuid;
begin
  -- Production baselines.
  select count(*) into v_rounds_before
  from fantasy_rounds where season='2026/27' and round_no<9000;

  select count(*) into v_games_before
  from fantasy_games where season='2026/27';

  select count(*) into v_real_team_rows_before
  from fantasy_user_teams
  where season='2026/27' and user_id<>v_user;

  -- Defensive cleanup in case an earlier interrupted test left synthetic rows.
  delete from fantasy_user_teams where user_id=v_user and season='2026/27';
  delete from fantasy_rounds where season='2026/27' and round_no=8998;
  delete from fantasy_player_season_prices
  where season='2026/27'
    and player_id in (select id from fantasy_players where external_id like '__e2e_transfer__:%');
  delete from fantasy_players where external_id like '__e2e_transfer__:%';

  -- A synthetic round earlier than the real season opener, but below 9000 so
  -- the production RPC selects it as the next open round.
  insert into fantasy_rounds(season,round_no,name,starts_at,deadline_at,ends_at,status,updated_at)
  values(
    '2026/27',8998,'__e2e_transfer__',now()+interval '12 hours',
    now()+interval '12 hours',now()+interval '18 hours','open',now()
  ) returning id into v_round;

  -- 15 synthetic players: initial 12 = 6F/4D/2G, plus three spare forwards.
  -- Every player gets a unique synthetic club so club limits can never interfere.
  v_players := array[]::uuid[];
  for i in 1..15 loop
    v_pos := case when i<=9 then 'W' when i<=13 then 'D' else 'G' end;
    v_name := '__e2e_transfer__:'||i;
    insert into fantasy_players(external_id,name,team,position,price,active,updated_at)
    values(v_name,v_name,'E2E Club '||i,v_pos,5.00,true,now())
    returning id into v_pid;
    v_players := array_append(v_players,v_pid);
  end loop;

  insert into fantasy_player_season_prices(season,player_id,price)
  select '2026/27',unnest(v_players),5.00;

  -- Initial roster = forwards 1-6, defenders 10-13, goalies 14-15.
  v_roster := array[
    v_players[1],v_players[2],v_players[3],v_players[4],v_players[5],v_players[6],
    v_players[10],v_players[11],v_players[12],v_players[13],
    v_players[14],v_players[15]
  ];
  v_captain := v_players[1];
  v_vice := v_players[2];

  insert into fantasy_user_teams(user_id,season,name,budget,updated_at)
  values(v_user,'2026/27','__e2e_transfer__',100.00,now())
  returning id into v_team;

  insert into fantasy_user_team_players(
    team_id,player_id,purchase_price,is_captain,is_vice_captain,line_no
  )
  select
    v_team,p.id,5.00,(p.id=v_captain),(p.id=v_vice),1
  from fantasy_players p
  where p.id=any(v_roster);

  perform set_config('request.jwt.claim.sub',v_user::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);

  -- Check 1: fixed prices. Change the live fantasy_players.price of the first
  -- incoming player after the season-price snapshot is locked.
  v_in1 := v_players[7];
  v_in2 := v_players[8];
  v_in3 := v_players[9];
  v_out1 := v_players[4];
  v_out2 := v_players[5];
  v_out3 := v_players[6];

  update fantasy_players set price=19.00 where id=v_in1;

  v_roster := array_replace(v_roster,v_out1,v_in1);
  select * into v_result
  from apply_fantasy_transfers_v1('2026/27','__e2e_transfer__',v_roster,v_captain,v_vice);

  select sp.price,fp.price into v_locked_price,v_live_price
  from fantasy_player_season_prices sp
  join fantasy_players fp on fp.id=sp.player_id
  where sp.season='2026/27' and sp.player_id=v_in1;

  select ti.price into v_team_cost
  from fantasy_transfer_items ti
  join fantasy_transfer_batches tb on tb.id=ti.batch_id
  where tb.team_id=v_team and ti.player_id=v_in1 and ti.direction='in'
  order by ti.created_at desc limit 1;

  return query select
    1,
    'Faste sesongpriser brukes ved transfer',
    (v_locked_price=5.00 and v_live_price=19.00 and v_team_cost=5.00 and v_result.team_cost=60.00),
    format('locked=%s live=%s transfer_price=%s team_cost=%s',v_locked_price,v_live_price,v_team_cost,v_result.team_cost);

  -- Check 2: second transfer is allowed and exhausts the round quota.
  v_roster := array_replace(v_roster,v_out2,v_in2);
  select * into v_result
  from apply_fantasy_transfers_v1('2026/27','__e2e_transfer__',v_roster,v_captain,v_vice);

  return query select
    2,
    'To bytter per runde er tillatt',
    (v_result.transfers_used=2 and v_result.transfers_remaining=0),
    format('used=%s remaining=%s team_cost=%s',v_result.transfers_used,v_result.transfers_remaining,v_result.team_cost);

  -- Check 3: third transfer in the same round must be rejected atomically.
  begin
    v_roster := array_replace(v_roster,v_out3,v_in3);
    perform * from apply_fantasy_transfers_v1('2026/27','__e2e_transfer__',v_roster,v_captain,v_vice);
  exception when others then
    v_limit_error := sqlerrm;
    v_limit_blocked := position('Transfer limit exceeded' in sqlerrm)>0;
  end;

  -- Restore the expected two-transfer roster for subsequent checks.
  v_roster := array_replace(v_roster,v_in3,v_out3);

  select count(*) into v_transfer_items
  from fantasy_transfer_items ti
  join fantasy_transfer_batches tb on tb.id=ti.batch_id
  where tb.team_id=v_team;

  return query select
    3,
    'Tredje bytte i samme runde blokkeres',
    (v_limit_blocked and v_transfer_items=4 and not exists(
      select 1 from fantasy_user_team_players where team_id=v_team and player_id=v_in3
    )),
    format('blocked=%s items=%s error=%s',v_limit_blocked,v_transfer_items,v_limit_error);

  -- Check 4: line changes are free. Choose 3F/2D/1G for line 1.
  select count(*) into v_batches_before
  from fantasy_transfer_batches where team_id=v_team;

  v_line1 := array[
    v_players[1],v_players[2],v_in1,
    v_players[10],v_players[11],
    v_players[14]
  ];

  select * into v_line
  from set_fantasy_lineup_v1('2026/27',v_line1);

  select count(*) into v_batches_after_line
  from fantasy_transfer_batches where team_id=v_team;

  return query select
    4,
    'Fri flytting mellom 1. og 2. rekke bruker ikke bytter',
    (v_line.line1_count=6 and v_line.line2_count=6 and v_batches_before=v_batches_after_line and v_batches_before=2),
    format('line1=%s line2=%s transfer_batches=%s→%s',v_line.line1_count,v_line.line2_count,v_batches_before,v_batches_after_line);

  -- Cleanup all synthetic rows.
  delete from fantasy_user_teams where id=v_team;
  delete from fantasy_rounds where id=v_round;
  delete from fantasy_player_season_prices where season='2026/27' and player_id=any(v_players);
  delete from fantasy_players where id=any(v_players);

  select count(*) into v_rounds_after
  from fantasy_rounds where season='2026/27' and round_no<9000;

  select count(*) into v_games_after
  from fantasy_games where season='2026/27';

  select count(*) into v_real_team_rows_after
  from fantasy_user_teams
  where season='2026/27' and user_id<>v_user;

  return query select
    5,
    'Ekte 2026/27-data er urørt etter testen',
    (v_rounds_before=v_rounds_after and v_games_before=v_games_after and v_real_team_rows_before=v_real_team_rows_after
      and not exists(select 1 from fantasy_players where external_id like '__e2e_transfer__:%')
      and not exists(select 1 from fantasy_user_teams where user_id=v_user and season='2026/27')),
    format('rounds %s→%s, games %s→%s, real teams %s→%s',v_rounds_before,v_rounds_after,v_games_before,v_games_after,v_real_team_rows_before,v_real_team_rows_after);

exception when others then
  -- Best-effort cleanup before re-raising unexpected failures.
  delete from fantasy_user_teams where user_id=v_user and season='2026/27';
  delete from fantasy_rounds where season='2026/27' and round_no=8998;
  delete from fantasy_player_season_prices
  where season='2026/27'
    and player_id in (select id from fantasy_players where external_id like '__e2e_transfer__:%');
  delete from fantasy_players where external_id like '__e2e_transfer__:%';
  raise;
end;
$$;

revoke all on function run_fantasy_transfers_e2e_test() from public;
grant execute on function run_fantasy_transfers_e2e_test() to service_role;
