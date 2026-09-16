# Endelig EHL-kalender 2026/27 – fase 2

Beslutning 2026-09-16: produkteier bekrefter 40 kamper per klubb og publisert endelig terminliste. Dette erstatter den uavklarte 40/48-forutsetningen i Sparta-addendumet.

## Kontroll mot kilden

[HockeyLive TournamentMatches, turnering 448981](https://sf34-terminlister-prod-app.azurewebsites.net/ta/TournamentMatches/?tournamentId=448981) ble hentet på nytt 2026-09-16. Appens faktiske provider normaliserte alle 180 publiserte kamper. Sammenligning mot produksjonsdatabasen viste null avvik i ekstern kamp-ID, hjemmelag, bortelag, kampstart og kilderunde. Ingen nye, slettede eller flyttede aktive kamper måtte korrigeres manuelt; ordinær synk hadde allerede hentet terminlisten.

- Ni aktive klubber, 40 kamper per klubb, 180 kamper totalt.
- 36 lagpar, fem kamper per lagpar.
- Alle 180 aktive kamper har samsvarende fantasy-kamp og gyldig rundekobling.
- 45 eksisterende fantasy-runder, ingen tomme runder og ingen kamper utenfor rundeintervallet.
- Null snapshots ved kontrollen. De 45 annullerte Sparta-kampene forblir arkivert og utelatt fra konkurransen.
- Kontrollfingeravtrykk før fristjustering: `c73ac5d3c1a26b18e1c79399e5f3ab2e` (MD5 av sorterte eksterne ID-er, klubber, kampstart som epoch og kilderunde; operativ sammenligningsverdi, ikke sikkerhetssignatur).

40 kamper per klubb betyr fortsatt **45 fantasy-runder**. Rundenes ID-er, kampkoblinger og sluttdatoer beholdes. Alle spillere har samme tilgjengelige kalender; lag kan ha null, én eller flere kamper i en runde.

## Frister

Gjeldende regel er første kampstart i fantasy-runden. Fire frister lå tidligere fordi Sparta-kamper er fjernet eller fordi gjenstående kamper starter senere. Bare disse fire rundene får ny `starts_at`/`deadline_at`:

| Runde | Dato | Gammel frist | Ny frist |
| --- | --- | --- | --- |
| GW1 | 16. september 2026 | 18.30 | **19.00** |
| GW9 | 15. oktober 2026 | 18.00 | **18.30** |
| GW31 | 16. januar 2027 | 15.00 | **16.00** |
| GW37 | 6. februar 2027 | 15.00 | **16.00** |

Alle tider er norsk tid. Tabelltipsfristen følger sesongens første kamp og flyttes samtidig til **16. september 2026 kl. 19.00**. Ingen frist flyttes tidligere. Endringen skal bare kjøres før gammel første frist og uten snapshots; migreringen avviser ellers hele transaksjonen.

## Event Weeks og personlige boostere

De publiserte Event Weeks beholdes på samme runde og dato, med samme budsjett og scoringregler. Ingen ny flytting av eventer er besluttet. Det gamle kriteriet «alle ti lag spiller én kamp» gjelder ikke lenger: ni klubber kan ikke alle spille nøyaktig én kamp i samme runde.

| Event | Runde | Frist, norsk tid | Kamper | Spillefri klubb |
| --- | --- | --- | ---: | --- |
| Rik Onkel | GW15 | 12. november 2026 kl. 18.30 | 4 | Frisk Asker |
| Julebord | GW22 | 3. desember 2026 kl. 18.30 | 4 | Stavanger |
| Fattig Onkel | GW38 | 18. februar 2027 kl. 18.00 | 4 | Vålerenga |

De øvrige åtte klubbene spiller én gang i hver av disse rundene. Spillefri betyr ingen tellende kamp for klubbens spillere den runden. Dette fremgår nå av det publiserte regelverket. Personlige boostere beholder eksisterende rundekoblinger og Event Week-sperrer.

## Implementering og kontroll

Migrering: `supabase/migrations/20260916053819_confirm_ehl_40_game_calendar_2026_27.sql`.

- Kontrollerer 180 gyldige kamper, ni klubber, 40 kamper per klubb, fem møter per lagpar, 45 åpne runder, samsvar mellom produktene og fravær av snapshots.
- Arkiverer opprinnelige runder, innstillinger og Event Weeks i privat `competition_adjustment_audit` under `ehl-2026-27-final-40-game-calendar`.
- Justerer bare berørte rundestarter/frister og tabelltipsfrist. Kamper, tips, spillerpriser, spiller-ID-er, eierskap, eventer og runde-ID-er endres ikke.
- Setter `ehl_2026_27_format` til `confirmed`, 40/180 kamper, ni klubber, 45 fantasy-runder og `calendar_provisional=false`.
- UI viser fastsatt serieformat og informasjon om spillefri i Event Weeks.
- `npm run test:ehl-calendar` kjører migreringen i isolert PostgreSQL med 180 syntetiske kamper. Den kontrollerer avvisning ved snapshots/ufullstendig kalender, fire justerte frister, bevarte kamper/eventer og idempotens. CI kjører testen før bygg.

Ved feil før commit rulles hele transaksjonen tilbake. Etter commit brukes audit til en avgrenset fremoverrettet korrigering; ingen automatisk rollback over nye brukerendringer eller snapshots. Migreringens ferdigmarkør forhindrer at en gjentakelse flytter frister på nytt.
