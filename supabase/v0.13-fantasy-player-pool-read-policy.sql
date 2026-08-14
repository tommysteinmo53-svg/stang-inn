-- Stang Inn Fantasy Hockey – v0.13
-- The team builder reads fantasy_players directly with the authenticated
-- browser client. If RLS is enabled without a SELECT policy, PostgREST
-- correctly returns an empty array instead of an error.
-- Expose only read access; writes remain unavailable to normal users.

alter table fantasy_players enable row level security;

drop policy if exists "Authenticated users can read fantasy player pool"
on fantasy_players;

create policy "Authenticated users can read fantasy player pool"
on fantasy_players
for select
to authenticated
using (true);

-- No INSERT/UPDATE/DELETE policies are granted here.
-- Team changes still go through save_fantasy_team_v1().
