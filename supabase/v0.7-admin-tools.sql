-- Stang Inn v0.7 – adminverktøy

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

insert into public.app_settings (key, value)
values ('points', '{"exact":5,"outcome":3}'::jsonb)
on conflict (key) do nothing;

create table if not exists public.announcements (
  id bigserial primary key,
  message text not null,
  active boolean default true,
  created_by uuid references public.players(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.app_settings enable row level security;
alter table public.announcements enable row level security;

drop policy if exists "Authenticated users can view settings" on public.app_settings;
create policy "Authenticated users can view settings"
on public.app_settings for select to authenticated using (true);

drop policy if exists "Authenticated users can view announcements" on public.announcements;
create policy "Authenticated users can view announcements"
on public.announcements for select to authenticated using (true);
