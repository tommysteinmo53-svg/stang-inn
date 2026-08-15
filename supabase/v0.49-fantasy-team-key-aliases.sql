-- Stang Inn Fantasy Hockey – v0.49
-- TEAM KEY ALIASES
-- Normalizes HockeyLive / roster / schedule naming variants to one stable club key.
-- Used by preseason audit, xFP, upcoming fixtures and team comparisons.

create or replace function fantasy_team_key(p_team text)
returns text
language sql
immutable
parallel safe
as $$
  with n as (
    select
      lower(
        regexp_replace(
          translate(
            coalesce(p_team,''),
            'ÆØÅæøåÉÈÊËéèêëÁÀÂÄáàâäÓÒÔÖóòôöÜü',
            'AOAaoaEEEEeeeeAAAAaaaaOOOOooooUu'
          ),
          '[^a-zA-Z0-9]+',
          '',
          'g'
        )
      ) as s
  )
  select case
    when s like '%valerenga%' then 'valerenga'
    when s like '%storhamar%' then 'storhamar'
    when s like '%friskasker%' or s like '%iffriskasker%' then 'frisk'
    when s like '%stavanger%' or s like '%oilers%' then 'oilers'
    when s like '%sparta%' then 'sparta'
    when s like '%stjernen%' then 'stjernen'
    when s like '%lorenskog%' then 'lorenskog'
    when s like '%lillehammer%' then 'lillehammer'
    when s like '%narvik%' then 'narvik'
    when s like '%nidaros%' then 'nidaros'
    when s like '%ringerike%' then 'ringerike'
    else s
  end
  from n;
$$;

comment on function fantasy_team_key(text) is
  'Canonical hockey team key. Normalizes known EHL/HockeyLive naming variants (including Vålerenga Ishockey Elite vs Vålerenga Elite) before comparisons.';

-- Read-only smoke test examples:
-- select fantasy_team_key('Vålerenga Ishockey Elite'), fantasy_team_key('Vålerenga Elite');
-- both should return: valerenga
