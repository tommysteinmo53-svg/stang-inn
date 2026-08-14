-- Stang Inn Fantasy Hockey – v0.11
-- Read-only production audit for a published fantasy price revision.
-- IMPORTANT: the audit population is the publication itself, not every
-- historical fantasy_players row with active=true.

create or replace function audit_fantasy_price_publication(p_publication uuid)
returns table(
  publication_id uuid,
  expected_rows integer,
  audit_rows bigint,
  roster_players bigint,
  roster_with_price bigint,
  roster_without_price bigint,
  duplicate_roster_player_ids bigint,
  duplicate_roster_names bigint,
  missing_player_rows bigint,
  revision_price_mismatches bigint,
  min_price numeric,
  max_price numeric
)
language sql
security definer
set search_path = public
as $$
  with pub as (
    select id, player_count
    from fantasy_price_publications
    where id = p_publication
  ),
  revision as (
    select player_id, player_name, new_price
    from fantasy_price_publication_rows
    where publication_id = p_publication
  ),
  roster as (
    select r.player_id, r.player_name, r.new_price, fp.id as db_player_id, fp.name as db_name, fp.price
    from revision r
    left join fantasy_players fp on fp.id = r.player_id
  ),
  duplicate_ids as (
    select player_id
    from revision
    group by player_id
    having count(*) > 1
  ),
  duplicate_names as (
    select lower(player_name) as normalized_name
    from revision
    group by lower(player_name)
    having count(*) > 1
  )
  select
    pub.id,
    pub.player_count,
    (select count(*) from revision),
    (select count(distinct player_id) from revision),
    (select count(*) from roster where db_player_id is not null and price is not null),
    (select count(*) from roster where db_player_id is not null and price is null),
    (select count(*) from duplicate_ids),
    (select count(*) from duplicate_names),
    (select count(*) from roster where db_player_id is null),
    (select count(*) from roster where db_player_id is not null and price is distinct from new_price),
    (select min(price) from roster where db_player_id is not null),
    (select max(price) from roster where db_player_id is not null)
  from pub;
$$;

revoke all on function audit_fantasy_price_publication(uuid) from public;
grant execute on function audit_fantasy_price_publication(uuid) to service_role;

-- Direct SQL Editor audit for the V4.6.1 publication:
-- select * from audit_fantasy_price_publication('7aec3a0a-13c9-47d6-bc7d-a8ae24fcbb8f');
-- Expected healthy result:
-- expected_rows=244, audit_rows=244, roster_players=244,
-- roster_with_price=244, roster_without_price=0,
-- duplicate_roster_player_ids=0, duplicate_roster_names=0,
-- missing_player_rows=0, revision_price_mismatches=0.
