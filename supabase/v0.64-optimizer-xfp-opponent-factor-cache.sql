-- Cache repeated opponent-factor calculations in the 2026/27 admin xFP horizon RPC.
-- A player/fixture join can otherwise invoke the same costly historical/live
-- opponent model hundreds of times, exceeding PostgREST statement_timeout.
-- This migration preserves the RPC signature, auth checks and scoring formula.
DO $migration$
DECLARE v_sql text;
BEGIN
  v_sql := pg_get_functiondef('public.get_fantasy_xfp_round_horizons_admin_v2(text)'::regprocedure);
  IF position('opponent_factors as materialized' in v_sql) > 0 THEN
    RAISE NOTICE 'Opponent factors already cached';
    RETURN;
  END IF;
  IF position('fixture_xfp as materialized (' in v_sql)=0
     OR position('fantasy_xfp_opponent_factor(x.opponent,x.player_position,p_season)' in v_sql)=0
     OR position('from fixtures x join features f on f.player_id=x.player_id' in v_sql)=0 THEN
    RAISE EXCEPTION 'Unexpected xFP RPC body: manual review required';
  END IF;
  v_sql := replace(v_sql,
    'fixture_xfp as materialized (',
    'opponent_factors as materialized (select distinct o.opponent,o.player_position, fantasy_xfp_opponent_factor(o.opponent,o.player_position,p_season) as factor from (select distinct fx.opponent,fx.player_position from fixtures fx) o), fixture_xfp as materialized (');
  v_sql := replace(v_sql,
    'fantasy_xfp_opponent_factor(x.opponent,x.player_position,p_season)',
    'ofac.factor');
  v_sql := replace(v_sql,
    'from fixtures x join features f on f.player_id=x.player_id',
    'from fixtures x join features f on f.player_id=x.player_id join opponent_factors ofac on ofac.opponent=x.opponent and ofac.player_position=x.player_position');
  EXECUTE v_sql;
END $migration$;
