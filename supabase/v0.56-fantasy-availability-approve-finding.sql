-- Stang Inn Fantasy Hockey – v0.56
-- MP-09.5: atomic admin approval of a reviewed availability finding.
-- One transaction updates current availability, appends history and marks the finding approved.

create or replace function public.fantasy_approve_availability_finding(
  p_finding_id bigint,
  p_reviewer_id uuid,
  p_review_note text default null
)
returns table(player_id uuid, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.fantasy_availability_findings%rowtype;
  roster_ok boolean;
begin
  select * into f
  from public.fantasy_availability_findings
  where id = p_finding_id
  for update;

  if not found then
    raise exception 'Availability-funn % finnes ikke', p_finding_id;
  end if;

  if f.review_status = 'approved' then
    raise exception 'Availability-funn % er allerede godkjent', p_finding_id;
  end if;

  if f.review_status = 'rejected' then
    raise exception 'Avvist availability-funn må åpnes for review før godkjenning';
  end if;

  if f.proposed_player_id is null then
    raise exception 'Funn % mangler verifisert spiller', p_finding_id;
  end if;

  select exists(
    select 1 from public.fantasy_players p
    where p.id = f.proposed_player_id
      and p.active = true
      and p.on_current_roster = true
  ) into roster_ok;

  if not roster_ok then
    raise exception 'Foreslått spiller finnes ikke i aktiv roster';
  end if;

  insert into public.fantasy_player_availability (
    player_id,status,note,expected_return,source_url,source_label,source_published_at,updated_at,updated_by
  ) values (
    f.proposed_player_id,f.raw_status,f.raw_note,null,f.source_url,f.source_label,f.source_published_at,now(),p_reviewer_id
  )
  on conflict (player_id) do update set
    status = excluded.status,
    note = excluded.note,
    expected_return = excluded.expected_return,
    source_url = excluded.source_url,
    source_label = excluded.source_label,
    source_published_at = excluded.source_published_at,
    updated_at = excluded.updated_at,
    updated_by = excluded.updated_by;

  insert into public.fantasy_player_availability_history (
    player_id,status,note,expected_return,source_url,source_label,source_published_at,created_by
  ) values (
    f.proposed_player_id,f.raw_status,f.raw_note,null,f.source_url,f.source_label,f.source_published_at,p_reviewer_id
  );

  update public.fantasy_availability_findings
  set review_status = 'approved',
      reviewed_at = now(),
      reviewed_by = p_reviewer_id,
      review_note = nullif(trim(coalesce(p_review_note,'')),'')
  where id = p_finding_id;

  return query select f.proposed_player_id, f.raw_status;
end;
$$;

revoke all on function public.fantasy_approve_availability_finding(bigint,uuid,text) from public;
revoke all on function public.fantasy_approve_availability_finding(bigint,uuid,text) from anon, authenticated;
grant execute on function public.fantasy_approve_availability_finding(bigint,uuid,text) to service_role;

comment on function public.fantasy_approve_availability_finding(bigint,uuid,text) is
'Atomically approves one reviewed availability finding: verifies current roster player, upserts current availability, appends audit history, and marks the finding approved. Service-role only.';

notify pgrst, 'reload schema';
