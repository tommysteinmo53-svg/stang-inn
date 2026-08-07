-- Stang Inn v0.5 – synklogg og admin-oversikt

create table if not exists public.sync_runs (
  id bigserial primary key,
  provider text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean not null default false,
  imported_count integer not null default 0,
  finished_count integer not null default 0,
  error_message text
);

alter table public.sync_runs enable row level security;

drop policy if exists "Admins can view sync runs" on public.sync_runs;
create policy "Admins can view sync runs"
on public.sync_runs
for select
to authenticated
using (
  exists (
    select 1 from public.players p
    where p.id = auth.uid() and p.admin = true
  )
);
