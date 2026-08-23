begin;

-- MP-13.3: tipping score ownership and input integrity.
-- Users may read visible tip rows according to RLS, but scoring is server-owned.
-- Remove broad INSERT/UPDATE privileges so authenticated clients cannot write
-- points (or generated/default columns) directly through the Data API.
revoke insert, update on table public.tips from anon;
revoke insert, update on table public.tips from authenticated;

grant insert (player_id, match_id, home_tip, away_tip) on table public.tips to authenticated;
grant update (player_id, match_id, home_tip, away_tip) on table public.tips to authenticated;

-- UI already enforces non-negative scores; make the database enforce the same
-- invariant for direct API clients as well.
alter table public.tips
  add constraint tips_home_tip_nonnegative check (home_tip >= 0),
  add constraint tips_away_tip_nonnegative check (away_tip >= 0);

commit;
