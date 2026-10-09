-- One-time repair proposal for duplicate 2026/27 global bonus rules.
-- REVIEW FIRST. This is not run automatically. Existing points may have been
-- calculated using either value because rule retrieval lacked ordering.
-- Proposed canonical values: PP goal +2, PP assist +1, SH goal +6, SH assist +4.
-- Changes ONLY the four known zero-valued duplicate rows, preserving history.
begin;
do $$
declare conflicts integer;
begin
 select count(*) into conflicts from (
   select key from public.fantasy_scoring_rules
   where season='2026/27' and active and position is null
     and key in ('powerplay_goal_bonus','powerplay_assist_bonus','shorthanded_goal_bonus','shorthanded_assist_bonus')
   group by key having count(*)<>2
 ) x;
 if conflicts<>0 then raise exception 'Unexpected bonus rule count; abort'; end if;
 if (select count(*) from public.fantasy_scoring_rules
     where season='2026/27' and active and position is null
       and ((key='powerplay_goal_bonus' and points in (0,2))
        or (key='powerplay_assist_bonus' and points in (0,1))
        or (key='shorthanded_goal_bonus' and points in (0,6))
        or (key='shorthanded_assist_bonus' and points in (0,4))))<>8
 then raise exception 'Unexpected bonus values; abort'; end if;
end $$;
update public.fantasy_scoring_rules set active=false
where id in (
 '7533aca2-e70f-44c4-8eb8-c90e43e3c768',
 '9a57ac9e-6264-4f36-bbc7-7be6b9b35911',
 '197d8d62-233d-4e61-a2f1-b0e0e51cf9e3',
 '8335266e-8164-4303-b1e7-7dcdf4f2e47c'
) and season='2026/27' and active and position is null and points=0;
-- Final review: each key should have one active nonzero row.
select key,points,active from public.fantasy_scoring_rules
where season='2026/27' and position is null
and key in ('powerplay_goal_bonus','powerplay_assist_bonus','shorthanded_goal_bonus','shorthanded_assist_bonus')
order by key,active desc;
rollback; -- SAFETY DEFAULT: replace with COMMIT only after approved review.
