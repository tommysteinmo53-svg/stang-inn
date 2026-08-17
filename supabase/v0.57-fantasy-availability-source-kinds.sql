-- Stang Inn Fantasy Hockey – v0.57
-- MP-09: explicit source kinds for local media and official social-media findings.
-- Social findings remain manual/admin-reviewed; this migration only improves provenance.

alter table public.fantasy_availability_findings
  drop constraint if exists fantasy_availability_findings_source_kind_check;

alter table public.fantasy_availability_findings
  add constraint fantasy_availability_findings_source_kind_check
  check (source_kind in ('club','nitten','hockeylive','local_media','facebook','instagram','other'));

comment on column public.fantasy_availability_findings.source_kind is
'Provenance category: club, nitten, hockeylive, local_media, facebook, instagram, or other. All findings remain non-authoritative until explicit admin approval.';

notify pgrst, 'reload schema';
