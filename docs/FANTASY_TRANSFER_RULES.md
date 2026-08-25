# Stang Inn XI – transferregler 2026/27

Status: låst for MP-04.5/MP-04.6 og MP-03.7.

## Ordinære fantasy-runder

- Hvert lag kan gjøre **maks 2 permanente spillerbytter per ordinær fantasy-runde**.
- Ubrukte bytter **spares ikke** til senere runder.
- Det finnes **ingen ekstra bytter mot poengtrekk**.
- **Bytteboost** øker grensen til **4 bytter** i den valgte ordinære runden.
- Bytteboost låses irreversibelt idet lagret transferbruk passerer 2, altså når bytte nummer 3 gjennomføres.
- Permanente transfers er sperret i **Rik Onkel**- og **Fattig Onkel**-runder. Eventlag er separate midlertidige lag og skal aldri skrive til ordinær transferhistorikk.

## Når teller et bytte?

Et spillerbytte teller først når brukeren **lagrer** et gyldig lag og serveren har gjennomført transfer-batchen. Valg og omvalg i UI før lagring er gratis.

Et lagret bytte er gjennomført. Hvis en bruker senere bytter tilbake før samme deadline, er dette et nytt bytte og bruker ny kvote. Gjennomførte bytter refunderes ikke.

Disse endringene teller **ikke** som spillerbytte:

- rekke 1 / rekke 2
- kaptein
- visekaptein
- lagnavn

## Effektiv runde og deadline

Transfers gjelder alltid neste åpne ordinære fantasy-runde slik den autoritative `fantasy_rounds`-logikken definerer den. Deadline er første kampstart i runden.

Et lags klubb kan ha 0, 1 eller flere kamper i runden uten at dette endrer transferkvoten.

Ved deadline er rundens snapshot historisk fasit. Senere transfers skal aldri endre historiske snapshots eller poeng.

## Budsjett og faste spillerpriser

Ordinært lag har 100m budsjett.

For **2026/27 er spillerprisene faste gjennom hele sesongen**. Det skal ikke forekomme automatiske markedsprisendringer eller manuelle reprisinger etter sesongstart. Den autoritative prisen er spillerens rad i `fantasy_player_season_prices` for `2026/27`.

- Kjøpspris = låst sesongpris.
- Salgsverdi = samme låste sesongpris.
- Lagverdi/budsjettkontroll = summen av låste sesongpriser.
- `purchase_price` på lag og pris i transferhistorikken skal være den samme låste sesongprisen på gjennomføringstidspunktet.
- Endringer i `fantasy_players.price` skal ikke kunne gi en annen 2026/27-pris enn den låste sesongprisen.
- Dersom en helt ny spiller kommer inn etter sesongstart, kan spilleren få én førstegangspris. Når sesongprisraden finnes, er den fast resten av 2026/27.

Databasen håndhever dette etter første ordinære 2026/27-kampstart: eksisterende 2026/27-sesongpriser kan ikke endres eller slettes, heller ikke via admin/service-role. Pris-publiseringsløpet har i tillegg preseason `economy_lock_at` og kan ikke brukes til markedsreprising gjennom sesongen.

## Transferhistorikk

Hver gjennomført lagring med spillerbytter oppretter én transfer-batch med:

- fantasy-runde
- tidspunkt
- antall bytter
- lagverdi før og etter
- alle spillere UT
- alle spillere INN
- låst sesongpris per spiller ved gjennomføring

Ved flere samtidige bytter presenteres historikken som en batch (`UT: A, B` / `INN: C, D`) i stedet for å konstruere kunstige én-til-én-par.

## Serveren er fasit

UI kan forhåndsvise hvor mange bytter en endring vil bruke, men transfergrenser, budsjett, posisjoner, klubbgrense, deadline, snapshot-gate, Bytteboost, Event Week-sperre og låste sesongpriser skal alltid håndheves server-side.