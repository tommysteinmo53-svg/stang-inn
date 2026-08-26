# Masterplan-addendum – brukeradministrasjon

Sist oppdatert: 2026-08-26

Dette addendumet hører til MP-01 og er autoritativt sammen med `docs/MASTERPLAN.md` for felles brukeradministrasjon.

## Status

✅ `/admin/users` er etablert som eneste autoritative brukeradministrasjon for Stang Inn.

## Omfang

- sikker oversikt over registrerte profiler og Auth-status;
- endring av Stang Inn-profilnavn;
- administrasjon av administratorrolle;
- kontrollert deaktivering og gjenåpning uten tap av konkurransehistorikk;
- auditlogg for sensitive brukerhandlinger;
- permanent sletting er ikke tilgjengelig fra adminflaten;
- Hockeytipset-admin har ikke lenger egne brukerwrites og lenker til `/admin/users`.

## Sikkerhetskrav

- Auth/RLS skal ikke svekkes for brukeradministrasjon;
- sensitive Auth-data hentes server-side for verifisert administrator;
- vanlige brukere skal ikke få tilgang til e-post eller auditlogg;
- siste aktive administrator og egen administratorkonto skal beskyttes mot utilsiktet nedgradering/deaktivering;
- deaktiverte kontoer skal blokkeres i global AuthGate;
- historiske Fantasy-, Tipping- og miniligadata skal beholdes.

## Verifikasjon

Produksjonsflyten aktiv → deaktivert → gjenåpnet er verifisert, auditloggen registrerte handlingene, og `test:mp01:user-admin` kjøres i GitHub Actions. Detaljert operativ dokumentasjon ligger i `docs/MP01_USER_ADMIN.md`.
