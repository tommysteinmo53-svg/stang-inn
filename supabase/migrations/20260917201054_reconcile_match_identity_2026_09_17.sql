begin;
lock table public.fantasy_players, public.fantasy_player_game_stats, public.fantasy_player_points in share row exclusive mode;
do $$
declare
 old_id uuid;
 target_id uuid;
 adjustment_key text := 'match-identity-ponthus-2026-09-17';
begin
 if exists(select 1 from public.competition_adjustment_audit where adjustment=adjustment_key and scope='complete') then return; end if;
 select id into strict old_id from public.fantasy_players where external_id='nif:10603533';
 select id into strict target_id from public.fantasy_players where external_id='nif:7738536';
 if not exists(select 1 from public.fantasy_players where id=old_id and external_id='nif:10603533' and name='Ponthus Westerholm') or not exists(select 1 from public.fantasy_players where id=target_id and external_id='nif:7738536' and name='Ponthus Westerholm') then raise exception 'Reviewed identity no longer matches'; end if;
 if exists(select 1 from public.fantasy_user_team_players where player_id=old_id) or exists(select 1 from public.fantasy_team_round_snapshot_players where player_id=old_id) or exists(select 1 from public.fantasy_player_points where player_id=old_id) then raise exception 'Duplicate has ownership, snapshots or points: manual reconciliation required'; end if;
 if exists(select 1 from public.fantasy_player_game_stats a join public.fantasy_player_game_stats b on a.game_id=b.game_id where a.player_id=old_id and b.player_id=target_id) then raise exception 'Conflicting statistics'; end if;
 insert into public.competition_adjustment_audit(adjustment,scope,before_rows) select adjustment_key,'player',jsonb_agg(to_jsonb(p)) from public.fantasy_players p where id=old_id;
 insert into public.competition_adjustment_audit(adjustment,scope,before_rows) select adjustment_key,'stats',coalesce(jsonb_agg(to_jsonb(s)),'[]'::jsonb) from public.fantasy_player_game_stats s where player_id=old_id;
 update public.fantasy_player_game_stats set player_id=target_id where player_id=old_id;
 update public.fantasy_players set active=false,on_current_roster=false,available_for_purchase=false,updated_at=now() where id=old_id;
 insert into public.competition_adjustment_audit(adjustment,scope,before_rows) values(adjustment_key,'complete','[]'::jsonb);
end $$;
commit;
