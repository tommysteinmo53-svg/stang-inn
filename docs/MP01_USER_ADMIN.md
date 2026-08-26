# MP-01 – Felles brukeradministrasjon

Sist verifisert: 2026-08-26

`/admin/users` er den autoritative brukeradministrasjonen for Stang Inn på tvers av Fantasy og Tipping.

Funksjonen gir administrator oversikt over profiler og Auth-status, endring av Stang Inn-profilnavn, administrasjon av adminrolle, kontrollert deaktivering/gjenåpning og auditlogg. Permanent sletting er ikke tilgjengelig fra denne flaten, slik at konkurransehistorikk beholdes.

Sikkerhetsregler:

- sensitive brukerdata hentes kun via admin-kontrollert server-endepunkt;
- vanlige brukere får ikke utvidet tilgang til e-post eller auditlogg;
- egen administratorrolle kan ikke fjernes;
- siste aktive administrator kan ikke fjernes eller deaktiveres;
- deaktivert konto blokkeres også i den globale AuthGate;
- brukerhandlinger logges i `user_admin_audit`;
- Hockeytipset-admin har ikke lenger egen brukeradministrasjon og lenker til `/admin/users`.

Produksjonsflyten aktiv → deaktivert → gjenåpnet er testet, og MP-01 user-admin-regresjonen kjøres i GitHub Actions.
