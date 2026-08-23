-- MP-12.3 / MP-12.7 – pin search_path for immutable Fantasy scoring helper.
-- The function references no database objects, so an empty search_path is sufficient.

alter function public.fantasy_line_multiplier(smallint) set search_path = '';
