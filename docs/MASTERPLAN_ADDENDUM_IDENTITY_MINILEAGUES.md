# Stang Inn – MASTERPLAN ADDENDUM: identitet, lagnavn, miniligaer og Event Weeks

> Operativt tillegg til `docs/MASTERPLAN.md`. GitHub `main` er teknisk source of truth. Dette tillegget gjelder foran eldre formuleringer dersom det oppstår konflikt, inntil punktene er foldet inn i hovedfilen.

Sist oppdatert: 2026-08-24

## Nye masterplanpunkter

### MP-01.7 ✅ Obligatorisk brukerprofilnavn ved registrering

Alle brukere har nå et eksplisitt navn i Stang Inn-profilen som kan brukes videre i Fantasy, Tipping, leaderboard og miniligaer.

- Google-navn brukes kun som forslag; brukeren må eksplisitt bekrefte/skrive inn profilnavnet før profilen regnes som komplett.
- Profilnavnet lagres i den generelle `public.players`-profilen og completion markeres med `profile_name_confirmed_at`.
- Eksisterende gyldige profiler er migrert som ferdige; ufullstendige profiler sendes til en kontrollert `/onboarding`-flyt.
- Global `AuthGate` blokkerer direkte navigering til konkurranseflater til profilstatus er verifisert, slik at onboarding ikke kan omgås via URL.
- `complete_stanginn_profile_v1(text)` validerer server-side, normaliserer whitespace, krever 2–60 tegn og avviser kontrolltegn.
- RPC-en er authenticated-only. `anon` har ikke EXECUTE, authenticated-klienter har ikke direkte INSERT/UPDATE/DELETE på `players`, og `players.email` er ikke lesbar for vanlige konkurranseklienter.
- Ny Google-bruker er produksjonstestet gjennom hele onboardingflyten. Produksjonsstatus etter testen var 3/3 profiler bekreftet, 0 ufullstendige og 0 ugyldige bekreftede navn.
- `test:mp01:onboarding` regresjonsbeskytter completion-state, bypass-gate, eksplisitt lagring, servervalidering og profilprivilegier. Separat CI-probe bestod 8/8 kontroller 2026-08-24.

### MP-04.8 ✅ Obligatorisk lagnavn før Fantasy-lag kan lagres

Fantasy-lagnavn er nå en eksplisitt og serverhåndhevet del av lagidentiteten.

- Nye Fantasy-lag kan ikke lagres med tomt navn, whitespace-only, `Mitt lag`, `My team` eller generisk `Lag`.
- Kanonisk servervalidering normaliserer whitespace, krever 3–40 tegn, minst én bokstav eller ett tall og avviser kontrolltegn.
- `fantasy_user_teams` har en `BEFORE INSERT/UPDATE OF name`-trigger som bruker samme validator, slik at direkte RPC-/tabellskriving ikke kan omgå navnekravet.
- `rename_fantasy_team_v1(text,text)` er authenticated-only og endrer kun `fantasy_user_teams.name`/`updated_at`; roster, kaptein/visekaptein, transfers, snapshots, boostere og poeng berøres ikke.
- Lagbyggeren starter ikke lenger med `Mitt lag`. Nytt lag må ha gyldig navn før hovedlagring aktiveres.
- Eksisterende lag med placeholder-navn får en kontrollert kompletteringsflyt der kun navnet oppdateres. Eksisterende team-ID og alle relasjoner beholdes.
- Navneendring teller ikke som transfer og kan lagres separat fra spillerbytter.
- Produksjon hadde ett eksisterende 2026/27-lag med `Mitt lag`; dette laget ble bevisst ikke omskrevet automatisk. Read-only smoke bekreftet at laget fortsatt hadde 12 spillere og samme team-ID etter migrasjonen, og UI vil kreve eksplisitt nytt navn ved neste besøk.
- `test:mp04:transfers` er utvidet med MP-04.8-kontrakter for servervalidering, placeholder-sperre, authenticated rename, safe completion og ingen transferkobling. Vercel-build er grønn.

### MP-07.10 ⬜ Vis både lagnavn og eiernavn i Fantasy-tabeller

Fantasy leaderboard, rundetabeller og relevante miniliga-/konkurranseflater skal vise både lagnavn og profilnavnet til brukeren som eier laget.

- Presentasjonen skal være tydelig på mobil og desktop.
- Rangering/tie-break følger fortsatt autoritativ poenglogikk.
- Historiske snapshots/runder skal ikke omskrives feil ved navneendringer; visningspolicy må velges og testes eksplisitt.

### MP-07.11 ⬜ Fastsett og produksjonskonfigurer Rik Onkel og Fattig Onkel

Produktbeslutning er tatt:

- **GW15 – Rik Onkel** (200m eventlag).
- **GW38 – Fattig Onkel** (70m eventlag).

Beslutningen er dokumentert i `docs/MP07_EVENT_WEEK_SCHEDULE_2026_27.md`. Punktet står ⬜ til rundene er konfigurert i produksjonsdata og verifisert mot deadlines, transfers, snapshots, øvrige boostere, scoring og UI.

### MP-07.12 ⬜ Julebord Event Week – GW22

Produktbeslutning er tatt:

- **GW22 – Julebord**, torsdag 3. desember 2026.
- Tema: **Alle skal med!**
- I Julebord-runden teller både rekke 1 og rekke 2 **100 %** av sine ordinære fantasy-poeng.
- Kaptein beholder ordinær ×2 og visekaptein ordinær ×1,5 etter gjeldende regler.
- Personlige boostere skal ikke kunne brukes i Julebord-runden.
- Ordinære deadline-, snapshot-, klubb-, posisjons- og lagregler gjelder ellers.

Full produktregel og ferdigkriterier er dokumentert i `docs/MP07_JULEBORD_2026_27.md`.

Punktet kan først markeres ✅ når GW22 er verifisert mot den autoritative 45-runders kalenderen, eventtypen er konfigurert i produksjon, scoring/snapshot/boosterkonflikt fungerer korrekt, UI/regler viser runden tydelig og regresjonstester er bestått.

Sesongens planlagte felles Event Weeks er dermed:

1. GW15 – **Rik Onkel**.
2. GW22 – **Julebord**.
3. GW38 – **Fattig Onkel**.

### MP-13.6 ⬜ Felles miniligaer på tvers av Tipping og Fantasy

Miniliga-medlemskap skal være produktuavhengig: er en bruker medlem av en miniliga i Stang Inn, er brukeren medlem av den samme ligaen både i Tipping og Fantasy.

- Én felles ligaidentitet, eier/admin, invitasjonskode og medlemsliste.
- Fantasy og Tipping beholder separate poengsummer/rangeringstabeller innen samme liga.
- Ingen automatisk sammenblanding av Fantasy- og Tipping-poeng. Eventuell samlet kombinasjonskonkurranse må være et eksplisitt senere produktvalg.
- Opprett/join/leave skal gjelde begge produkter gjennom samme medlemskap.
- Eksisterende liga-/medlemsdata skal migreres sikkert uten duplikate medlemskap eller tap av historikk.
- RLS, adminrettigheter og medlemsinnsyn skal testes eksplisitt.
- Felles ligaoversikt bør vise brukerens profilnavn, og Fantasy-tabellen skal i tillegg vise fantasy-lagnavn der dette finnes.

## Avhengigheter

Identitetsgrunnlaget MP-01.7 og obligatorisk Fantasy-lagnavn MP-04.8 er nå ferdige. Neste avhengighet er MP-07.10 lagnavn + eiernavn, deretter MP-13.6 felles miniligaer.

Event Weeks må være produksjonskonfigurert og verifisert før full pre-launch regresjon og før regelverket låses i MP-14. Rik Onkel/Fattig Onkel og Julebord skal behandles samlet i Chat 07 slik at kalender, UI, scoring, boosterkonflikter og snapshots verifiseres i én sammenhengende Event Week-pass.

## Oppdatert prioritert arbeidskø

1. **Chat 07 – MP-07.10: lagnavn + eiernavn i tabeller.** MP-01.7 og MP-04.8 gir nå stabile bruker- og lagidentiteter. Oppdater Fantasy leaderboard/runder/miniligavisning med begge identiteter og avklar historisk navnevisning eksplisitt.
2. **Chat 13 – MP-13.6: felles miniligaer.** Bygg ett medlemskap som brukes av både Tipping og Fantasy, med separate produkttabeller.
3. **Chat 07 – MP-07.11 + MP-07.12: produksjonskonfigurer Event Weeks.** Konfigurer og verifiser GW15 Rik Onkel, GW22 Julebord og GW38 Fattig Onkel. Julebord skal gi 100 % poeng fra begge rekker og blokkere personlige boostere. Verifiser alle tre mot kalender, deadlines, transfers, scoring, snapshots, UI og historikk.
4. **Chat 12 – MP-12.3 + MP-12.7: bred regresjon og pre-launch kvalitet.** Ta med profilnavn, lagnavn, leaderboardvisning, alle Event Weeks og felles miniliga-RLS i regresjonsmatrisen.
5. **Chat 01 + Chat 14 – MP-01.6 og MP-14.1–14.7: produksjons- og launch-gate.**
6. **Chat 14 – MP-14.8: GO LIVE** når alle kritiske gates er PASS.

**Sesongavhengig:** MP-06.6 gjennomføres i Chat 06 når representative 2026/27-seriekamper finnes. MP-02.6 og MP-09 fortsetter løpende gjennom sesongen.
