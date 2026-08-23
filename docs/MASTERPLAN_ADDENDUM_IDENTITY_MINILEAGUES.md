# Stang Inn – MASTERPLAN ADDENDUM: identitet, lagnavn og felles miniligaer

> Operativt tillegg til `docs/MASTERPLAN.md`. GitHub `main` er teknisk source of truth. Dette tillegget gjelder foran eldre formuleringer dersom det oppstår konflikt, inntil punktene er foldet inn i hovedfilen.

Sist oppdatert: 2026-08-23

## Nye masterplanpunkter

### MP-01.7 ⬜ Obligatorisk brukerprofilnavn ved registrering

Alle brukere skal ha et eksplisitt navn i Stang Inn-profilen som kan brukes videre i Fantasy, Tipping, leaderboard og miniligaer.

- Ved registrering med Google skal brukeren måtte bekrefte/skrive inn navnet sitt før registreringen regnes som komplett.
- Navnet skal lagres som Stang Inns eget profil-/visningsnavn og ikke være avhengig av at Google-navn alltid finnes eller er egnet.
- Eksisterende brukere uten navn skal få en kontrollert kompletteringsflyt før de kan delta fullt i konkurranseflater som krever navn.
- Navnefeltet skal ha server-side validering, rimelige lengdegrenser og håndtering av tomme/whitespace-only verdier.
- Endringer må bevare auth/RLS og ikke eksponere e-post eller andre unødvendige personopplysninger i offentlige tabeller.

### MP-04.8 ⬜ Obligatorisk lagnavn før Fantasy-lag kan lagres

Et Fantasy-lag skal ikke kunne lagres første gang uten at brukeren aktivt har registrert et gyldig lagnavn.

- Standard-/placeholder-navn som `Mitt lag`, tom streng eller tilsvarende skal ikke kunne passere som ferdig registrert lagnavn.
- Valideringen skal ligge både i UI og server-side slik at kravet ikke kan omgås via direkte kall.
- Eksisterende lag som fortsatt har generisk/ugyldig standardnavn skal få en kontrollert flyt for å velge nytt navn uten å miste spillere, snapshots, transfers eller historikk.
- Lagnavn skal ha rimelige lengde-/tegnregler og kunne endres uten at det teller som transfer.

### MP-07.10 ⬜ Vis både lagnavn og eiernavn i Fantasy-tabeller

Fantasy leaderboard, rundetabeller og relevante miniliga-/konkurranseflater skal vise både:

1. **Lagnavn** – fantasy-lagets registrerte navn.
2. **Eier** – profilnavnet til brukeren som opprettet/eier laget.

Krav:

- Presentasjonen skal være tydelig på mobil og desktop.
- Rangering/tie-break skal fortsatt følge autoritativ poenglogikk; eiernavn og lagnavn er visningsdata, ikke sportslig tie-break med mindre dette senere besluttes eksplisitt.
- Historiske snapshots/runder skal ikke omskrives feil ved navneendringer. Det skal defineres tydelig om historiske flater viser dagens profil-/lagnavn eller fryser navn per snapshot; dette må velges og testes eksplisitt før implementasjonen markeres ferdig.

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

Identitetskravene bør implementeres før felles miniligaer ferdigstilles. Da får både Tipping og Fantasy én stabil brukeridentitet å vise i ligaene, og Fantasy slipper generiske lag som `Mitt lag` i leaderboard/miniligaer.

Anbefalt rekkefølge innen dette sporet:

1. MP-01.7 – profilnavn/onboarding.
2. MP-04.8 – obligatorisk Fantasy-lagnavn.
3. MP-07.10 – vis lagnavn + eier i Fantasy-tabeller.
4. MP-13.6 – felles miniligaer på tvers av produktene.
5. MP-12 – regresjon av auth/RLS, lagring, leaderboard og liga-medlemskap.

## Oppdatert prioritert arbeidskø

1. **Chat 13 – MP-13.1–13.5: ferdigstill Tipping-kjernen.** Kartlegg faktisk status på `main` og fullfør kamptips/EHL-synk, tabelltips, automatisk scoring, awards/statistikk og sesongklar brukerflyt.
2. **Chat 01 – MP-01.7: obligatorisk profilnavn/onboarding.** Sørg for at Google-registrerte og eksisterende brukere har et eksplisitt Stang Inn-navn før konkurranse-/ligaflatene låses.
3. **Chat 04 – MP-04.8: obligatorisk lagnavn.** Ingen nye Fantasy-lag skal kunne lagres med `Mitt lag`/tomt standardnavn.
4. **Chat 07 – MP-07.10: lagnavn + eiernavn i tabeller.** Oppdater Fantasy leaderboard/runder/miniligavisning med begge identiteter.
5. **Chat 13 – MP-13.6: felles miniligaer.** Bygg ett medlemskap som brukes av både Tipping og Fantasy, med separate produkttabeller.
6. **Chat 12 – MP-12.3 + MP-12.7: bred regresjon og pre-launch kvalitet.** Ta med profilnavn, lagnavn, leaderboardvisning og felles miniliga-RLS i regresjonsmatrisen.
7. **Chat 01 + Chat 14 – MP-01.6 og MP-14.1–14.7: produksjons- og launch-gate.**
8. **Chat 14 – MP-14.8: GO LIVE** når alle kritiske gates er PASS.

**Sesongavhengig:** MP-06.6 gjennomføres i Chat 06 når representative 2026/27-seriekamper finnes. MP-02.6 og MP-09 fortsetter løpende gjennom sesongen.
