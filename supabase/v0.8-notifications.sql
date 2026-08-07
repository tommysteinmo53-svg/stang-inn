-- Stang Inn v0.8 – varslingssenter

create table if not exists public.notifications (
  id bigserial primary key,
  user_id uuid references public.players(id) on delete cascade,
  type text not null default 'info',
  title text not null,
  message text not null,
  link text,
  created_by uuid references public.players(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create table if not exists public.notification_reads (
  notification_id bigint references public.notifications(id) on delete cascade,
  user_id uuid references public.players(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index if not exists notification_reads_user_idx on public.notification_reads (user_id);

alter table public.notifications enable row level security;
alter table public.notification_reads enable row level security;

drop policy if exists "Users can view relevant notifications" on public.notifications;
create policy "Users can view relevant notifications"
on public.notifications for select to authenticated
using (user_id is null or user_id = auth.uid());

drop policy if exists "Users can view own notification reads" on public.notification_reads;
create policy "Users can view own notification reads"
on public.notification_reads for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can mark own notifications read" on public.notification_reads;
create policy "Users can mark own notifications read"
on public.notification_reads for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update own notification reads" on public.notification_reads;
create policy "Users can update own notification reads"
on public.notification_reads for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
