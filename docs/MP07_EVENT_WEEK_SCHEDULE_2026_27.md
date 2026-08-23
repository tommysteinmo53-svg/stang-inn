# MP-07.11 – Event Week-plan 2026/27

> Produktbeslutning for hvilke fantasy-runder som skal brukes til Rik Onkel og Fattig Onkel. Produksjonskonfigurasjon og verifisering gjøres i Chat 07 før MP-07.11 markeres ✅.

Sist oppdatert: 2026-08-23

## Beslutning

- **Rik Onkel:** Fantasy-runde **15** – torsdag **12. november 2026**. Deadline/første kampstart: **18:30 norsk tid**.
- **Fattig Onkel:** Fantasy-runde **38** – torsdag **18. februar 2027**. Deadline/første kampstart: **18:00 norsk tid**.

## Hvorfor disse rundene

Begge rundene er ordinære 5-kampsrunder der alle 10 EHL-lag spiller nøyaktig én kamp. Det gjør at Event Week-effekten handler om selve budsjettutfordringen – 200m i Rik Onkel og 70m i Fattig Onkel – og ikke blir dominert av blank/double-gameweek-fordeler.

Begge ligger også som første fantasy-runde etter et lengre opphold i terminlisten:

- GW14 avsluttes 1. november, mens GW15 starter 12. november. Dette gir omtrent halvannen uke til å markedsføre og bygge Rik Onkel-laget.
- GW37 avsluttes 7. februar, mens GW38 starter 18. februar. Dette gir tilsvarende planleggingstid før Fattig Onkel.

Eventene ligger langt fra hverandre og fordeler variasjonen over sesongen. GW39 ble bevisst valgt bort som Fattig Onkel fordi Narvik og Nidaros har to kamper der; en slik dobbelrunde ville gjort fixture-fordelen uforholdsmessig viktig i en runde som primært skal teste evnen til å bygge et godt 70m-lag.

## Verifisert mot produksjonskalender

Produksjonsdata for 2026/27 viser:

- GW15: 5 kamper, 10/10 lag med én kamp, 0 blanke lag og 0 lag med dobbeltkamp.
- GW38: 5 kamper, 10/10 lag med én kamp, 0 blanke lag og 0 lag med dobbeltkamp.

## Gjenstående før MP-07.11 kan markeres ✅

Chat 07 skal:

1. konfigurere `fantasy_event_weeks` med GW15 = `rich_uncle`, budsjett 200m;
2. konfigurere GW38 = `poor_uncle`, budsjett 70m;
3. kontrollere publiseringsstatus og at brukerflatene viser riktige runder/datoer;
4. kontrollere at personlige boostere er sperret i disse to rundene;
5. verifisere snapshot-, scoring- og transferkontraktene mot de valgte `round_id`-ene;
6. oppdatere `docs/FANTASY_BONUS_WEEKS_RULES.md`, `docs/MASTERPLAN.md`/relevant addendum og `docs/PROJECT_STATUS.md`;
7. markere MP-07.11 ✅ først når konfigurasjonen finnes i produksjon og kontrollene er bestått.

## Endringsregel

Etter at eventukene er publisert og brukerne kan begynne å planlegge eventlag, skal rundene ikke flyttes uten en eksplisitt styringsbeslutning og ny produksjonsverifisering.
