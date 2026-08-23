-- Stang Inn XI – MP-07.7A
-- Make snapshot players historically self-contained by freezing player_name.
-- Existing snapshot roster/lineup/price/C/VC data is not changed.

alter table public.fantasy_team_round_snapshot_players
  add column if not exists player_name text;

update public.fantasy_team_round_snapshot_players sp
set player_name = p.name
from public.fantasy_players p
where p.id = sp.player_id
  and sp.player_name is null;

-- Future snapshots freeze the player name at insert time. The existing freeze
-- functions do not need to know about this column; the trigger captures the
-- authoritative name once and the snapshot remains immutable afterwards.
create or replace function public.freeze_fantasy_snapshot_player_name_v1()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if new.player_name is null then
    select p.name into new.player_name
    from public.fantasy_players p
    where p.id = new.player_id;
  end if;

  if new.player_name is null then
    raise exception 'Cannot snapshot player % without a frozen player name', new.player_id;
  end if;

  return new;
end;
$$;

drop trigger if exists fantasy_snapshot_player_name_v1
  on public.fantasy_team_round_snapshot_players;

create trigger fantasy_snapshot_player_name_v1
before insert on public.fantasy_team_round_snapshot_players
for each row
execute function public.freeze_fantasy_snapshot_player_name_v1();

do $$
begin
  if exists (
    select 1
    from public.fantasy_team_round_snapshot_players
    where player_name is null
  ) then
    raise exception 'MP-07.7A backfill failed: snapshot player without player_name remains';
  end if;
end $$;

alter table public.fantasy_team_round_snapshot_players
  alter column player_name set not null;

comment on column public.fantasy_team_round_snapshot_players.player_name is
  'MP-07.7A immutable player display name captured with the authoritative round snapshot.';

comment on function public.freeze_fantasy_snapshot_player_name_v1() is
  'MP-07.7A trigger helper that freezes fantasy_players.name into each new snapshot-player row.';
