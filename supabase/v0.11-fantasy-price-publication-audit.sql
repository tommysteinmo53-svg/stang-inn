-- Stang Inn Fantasy Hockey – v0.11
-- Read-only production audit for a published fantasy price revision.
-- Run after V4.6.1 publication to verify atomic consistency.

create or replace function audit_fantasy_price_publication(p_publication uuid)
returns table(
  publication_id uuid,
  expected_rows integer,
  audit_rows bigint,
  active_players bigint,
  active_with_price bigint,
  active_without_price bigint,
  duplicate_active_names bigint,
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
    select player_id, new_price
    from fantasy_price_publication_rows
    where publication_id = p_publication
  ),
  active as (
    select id, name, price
    from fantasy_players
    where active = true
  ),
  dupes as (
    select lower(name) as normalized_name
    from active
    group by lower(name)
    having count(*) > 1
  )
  select
    pub.id,
    pub.player_count,
    (select count(*) from revision),
    (select count(*) from active),
    (select count(*) from active where price is not null),
    (select count(*) from active where price is null),
    (select count(*) from dupes),
    (select count(*)
       from revision r
       join fantasy_players fp on fp.id = r.player_id
      where fp.price is distinct from r.new_price),
    (select min(price) from active),
    (select max(price) from active)
  from pub;
$$;

revoke all on function audit_fantasy_price_publication(uuid) from public;
grant execute on function audit_fantasy_price_publication(uuid) to service_role;

-- Direct SQL Editor audit for the V4.6.1 publication:
-- select * from audit_fantasy_price_publication('7aec3a0a-13c9-47d6-bc7d-a8ae24fcbb8f');
