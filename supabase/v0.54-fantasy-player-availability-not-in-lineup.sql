-- Stang Inn Fantasy Hockey – v0.54
-- Adds neutral availability status for a player confirmed outside the match squad.

alter table public.fantasy_player_availability
  drop constraint if exists fantasy_player_availability_status_check;

alter table public.fantasy_player_availability
  add constraint fantasy_player_availability_status_check
  check (status in ('available','questionable','out','long_term','returning','not_in_lineup'));

alter table public.fantasy_player_availability_history
  drop constraint if exists fantasy_player_availability_history_status_check;

alter table public.fantasy_player_availability_history
  add constraint fantasy_player_availability_history_status_check
  check (status in ('available','questionable','out','long_term','returning','not_in_lineup'));

comment on column public.fantasy_player_availability.status is
'Current availability: available, questionable, out, long_term, returning, or not_in_lineup. not_in_lineup means confirmed outside the match squad without assuming injury.';

notify pgrst, 'reload schema';
