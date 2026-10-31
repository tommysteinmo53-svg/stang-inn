-- One-round admin transfer allowance. Does not alter ordinary players' limits.
-- Apply to both status reporting and the authoritative transfer validator.
DO $migration$
DECLARE v_name text; v_sql text;
BEGIN
 FOREACH v_name IN ARRAY ARRAY['apply_fantasy_transfers_v1','get_fantasy_transfer_status_v1'] LOOP
  SELECT pg_get_functiondef(p.oid) INTO v_sql FROM pg_proc p
  WHERE p.proname=v_name AND p.pronamespace='public'::regnamespace;
  IF v_sql IS NULL THEN RAISE EXCEPTION 'Missing function %',v_name; END IF;
  IF position('v_limit:=case when v_round.round_no=14 then 8 else 4 end;' in v_sql)>0 THEN CONTINUE; END IF;
  IF position('v_limit:=4;' || chr(10) || '  end if;' in v_sql)=0 THEN
    RAISE EXCEPTION 'Unexpected transfer RPC definition: %',v_name;
  END IF;
  v_sql:=replace(v_sql,'v_limit:=4;' || chr(10) || '  end if;',
    'v_limit:=case when v_round.round_no=14 then 8 else 4 end;' || chr(10) || '  end if;');
  EXECUTE v_sql;
 END LOOP;
END $migration$;
