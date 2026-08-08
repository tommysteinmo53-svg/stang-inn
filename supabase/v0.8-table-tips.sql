-- Stang Inn v0.8 – tabelltips
-- Kjør hele filen i Supabase SQL Editor.

create table if not exists public.table_tips (
  id bigserial primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  team text not null,
  position integer not null check (position between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (player_id, team),
  unique (player_id, position)
);

insert into public.app_settings (key, value)
values (
  'table_tips',
  jsonb_build_object(
    'deadline', '2026-09-11T16:00:00Z',
    'season', '2026/27'
  )
)
on conflict (key) do nothing;

create or replace function public.table_tips_is_locked()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    now() >= ((value->>'deadline')::timestamptz),
    true
  )
  from public.app_settings
  where key = 'table_tips';
$$;

grant execute on function public.table_tips_is_locked() to authenticated;

alter table public.table_tips enable row level security;

drop policy if exists "Players can view visible table tips" on public.table_tips;
create policy "Players can view visible table tips"
on public.table_tips
for select
to authenticated
using (
  auth.uid() = player_id
  or public.table_tips_is_locked()
);

drop policy if exists "Players can insert own table tips" on public.table_tips;
create policy "Players can insert own table tips"
on public.table_tips
for insert
to authenticated
with check (
  auth.uid() = player_id
  and not public.table_tips_is_locked()
);

drop policy if exists "Players can update own table tips" on public.table_tips;
create policy "Players can update own table tips"
on public.table_tips
for update
to authenticated
using (
  auth.uid() = player_id
  and not public.table_tips_is_locked()
)
with check (
  auth.uid() = player_id
  and not public.table_tips_is_locked()
);

drop policy if exists "Players can delete own table tips" on public.table_tips;
create policy "Players can delete own table tips"
on public.table_tips
for delete
to authenticated
using (
  auth.uid() = player_id
  and not public.table_tips_is_locked()
);

grant select, insert, update, delete on table public.table_tips to authenticated;
grant usage, select on sequence public.table_tips_id_seq to authenticated;

create or replace function public.touch_table_tips_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists table_tips_touch_updated_at on public.table_tips;
create trigger table_tips_touch_updated_at
before update on public.table_tips
for each row execute function public.touch_table_tips_updated_at();
