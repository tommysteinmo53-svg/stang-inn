-- MP-09.7 – atomic, idempotent availability notification delivery
-- Server/service-role only. Verifies authoritative availability and current 2026/27 ownership
-- before creating a notification. Duplicate deliveries return already_delivered without writing.

create or replace function public.deliver_fantasy_availability_notification_v1(
  p_user_id uuid,
  p_player_id uuid,
  p_status text,
  p_availability_updated_at timestamptz,
  p_title text,
  p_message text,
  p_link text default '/fantasy/team',
  p_created_by uuid default null
) returns table(
  delivered boolean,
  notification_id bigint,
  reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery_id uuid;
  v_notification_id bigint;
  v_current_status text;
  v_current_updated_at timestamptz;
begin
  if p_status not in ('questionable','returning','out','long_term','not_in_lineup') then
    return query select false, null::bigint, 'status_not_notifiable'::text;
    return;
  end if;

  select a.status, a.updated_at
    into v_current_status, v_current_updated_at
  from public.fantasy_player_availability a
  where a.player_id = p_player_id;

  if v_current_status is null then
    return query select false, null::bigint, 'availability_missing'::text;
    return;
  end if;

  if v_current_status <> p_status or v_current_updated_at is distinct from p_availability_updated_at then
    return query select false, null::bigint, 'availability_changed'::text;
    return;
  end if;

  if not exists (
    select 1
    from public.fantasy_user_teams t
    join public.fantasy_user_team_players tp on tp.team_id = t.id
    where t.user_id = p_user_id
      and t.season = '2026/27'
      and tp.player_id = p_player_id
  ) then
    return query select false, null::bigint, 'player_not_owned'::text;
    return;
  end if;

  insert into public.fantasy_availability_notification_deliveries(
    user_id, player_id, status, availability_updated_at
  ) values (
    p_user_id, p_player_id, p_status, p_availability_updated_at
  )
  on conflict (user_id, player_id, status, availability_updated_at) do nothing
  returning id into v_delivery_id;

  if v_delivery_id is null then
    select d.notification_id
      into v_notification_id
    from public.fantasy_availability_notification_deliveries d
    where d.user_id = p_user_id
      and d.player_id = p_player_id
      and d.status = p_status
      and d.availability_updated_at = p_availability_updated_at;

    return query select false, v_notification_id, 'already_delivered'::text;
    return;
  end if;

  insert into public.notifications(
    user_id, type, title, message, link, created_by
  ) values (
    p_user_id,
    case when p_status = 'returning' then 'info' else 'warning' end,
    p_title,
    p_message,
    coalesce(nullif(trim(p_link), ''), '/fantasy/team'),
    p_created_by
  )
  returning id into v_notification_id;

  update public.fantasy_availability_notification_deliveries
  set notification_id = v_notification_id
  where id = v_delivery_id;

  return query select true, v_notification_id, 'delivered'::text;
end;
$$;

revoke all on function public.deliver_fantasy_availability_notification_v1(uuid,uuid,text,timestamptz,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.deliver_fantasy_availability_notification_v1(uuid,uuid,text,timestamptz,text,text,text,uuid) to service_role;
