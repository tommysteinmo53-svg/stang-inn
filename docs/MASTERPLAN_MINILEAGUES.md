# Masterplan-tillegg – felles miniligaer

Dette dokumentet er et eksplisitt masterplan-krav for Stang Inn og skal innarbeides i `docs/MASTERPLAN.md` ved neste masterplansynk uten å miste samtidige endringer fra arbeidschattene.

## MP-13.6 – Felles miniligaer på tvers av Tipping og Fantasy

**Status: ⬜**

Miniliga-medlemskap skal være felles på tvers av Stang Inn Tipping og Stang Inn XI / EHL Fantasy. Når en bruker oppretter eller melder seg inn i en miniliga, skal medlemskapet gjelde begge produktene automatisk. Brukeren skal ikke måtte opprette eller bli med i samme liga to ganger.

Krav:

- Én kanonisk ligaidentitet og én medlemsliste per miniliga.
- Samme liganavn, eier/admin, invitasjonskode/lenke og medlemmer brukes av både Tipping og Fantasy.
- Hvert produkt beholder separat poengmotor, ranking og produktspesifikke statistikker. Felles medlemskap betyr ikke at Tipping-poeng og Fantasy-poeng blandes.
- Ligaen skal kunne vise separate faner/visninger for Fantasy-tabell og Tipping-tabell, og senere eventuelt en eksplisitt definert kombinert konkurranse dersom dette besluttes som eget regelpunkt.
- Opprettelse, innmelding, utmelding, administrasjon og sletting skal slå konsistent gjennom på begge produkter.
- Eksisterende liga-/medlemsdata skal kartlegges og migreres uten duplikater eller tap av medlemskap.
- Auth/RLS skal sikre at brukere kun kan endre egne medlemskap og at ligaeier/admin kun får de eksplisitt tillatte administrasjonshandlingene.
- Mobil/desktop UX skal gjøre det tydelig at miniligaen er en felles Stang Inn-liga med separate resultater for Tipping og Fantasy.
- Regresjonstester skal dekke opprettelse, join/leave, invitasjon, medlemskonsistens på tvers av produktene, separate leaderboards og RLS.

## Avhengigheter / eierskap

- Primært arbeidsområde: **Chat 13 / MP-13**, fordi Tipping nå er neste produktspor som skal ferdigstilles og felles ligamodell må avklares før Tipping-ligaer bygges videre.
- Fantasy-integrasjon mot eksisterende leaderboard/rundehistorikk berører **Chat 07 / MP-07**, men skal bruke samme kanoniske ligamedlemskap og ikke etablere en separat Fantasy-ligamodell.
- Database, auth og RLS berører **Chat 01 / MP-01**.
- Samlet UX berører **Chat 11 / MP-11** ved senere regresjon/polering.
- Testing inngår i **Chat 12 / MP-12**.

## Oppdatert prioritert arbeidskø

1. **Chat 13 – MP-13.1–13.6: Stang Inn Tipping + felles miniligaer.** Start med faktisk status på eksisterende tipping- og ligakode. Avklar/implementer den kanoniske felles ligamodellen før produktspesifikke ligaflater sementeres. Ferdigstill deretter kamptips/EHL-synk, tabelltips, automatisk poengberegning, awards/stats og sesongklar brukerflyt.
2. **Chat 12 – MP-12.3 + MP-12.7: bred regresjon og pre-launch kvalitet**, inkludert felles miniliga-medlemskap og separate Tipping-/Fantasy-leaderboards.
3. **Chat 01 + Chat 14 – MP-01.6 og MP-14.1–14.7: produksjons- og launch-gate.**
4. **Chat 14 – MP-14.8: GO LIVE** når alle kritiske gates er PASS.

Sesongavhengige MP-02.6, MP-06.6 og MP-09-drift kan fortsatt bryte inn når reelle kamp-/roster-/availability-data krever det.