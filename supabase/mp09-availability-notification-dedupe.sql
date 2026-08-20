-- MP-09.7 – idempotent availability notification delivery ledger
-- Additive schema only. This table records completed availability notification deliveries
-- so the same authoritative availability event cannot be delivered twice to one user.

create table if not exists public.fantasy_availability_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  player_id uuid not null references public.fantasy_players(id) on delete cascade,
  status text not null check (status in ('questionable','returning','out','long_term','not_in_lineup')),
  availability_updated_at timestamptz not null,
  notification_id bigint references public.notifications(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, player_id, status, availability_updated_at)
);

create index if not exists fantasy_availability_notification_deliveries_user_idx
  on public.fantasy_availability_notification_deliveries (user_id, created_at desc);

create index if not exists fantasy_availability_notification_deliveries_player_idx
  on public.fantasy_availability_notification_deliveries (player_id, availability_updated_at desc);

alter table public.fantasy_availability_notification_deliveries enable row level security;

-- Intentionally no authenticated-client policies.
-- Reads/writes are server-side only after fantasy-admin authorization.
revoke all on table public.fantasy_availability_notification_deliveries from anon, authenticated;
