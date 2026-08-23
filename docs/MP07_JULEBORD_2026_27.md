# MP-07 – Julebord Event Week 2026/27

Dato: 2026-08-23
Status: BESLUTTET PRODUKTREGEL – implementasjon/verifikasjon gjenstår

## Beslutning

**Julebord legges til GW22 – torsdag 3. desember 2026.**

Julebord er en felles Event Week for alle Fantasy-brukere og skal være tydelig forskjellig fra Rik Onkel og Fattig Onkel.

## Regel

**JULEBORD – Alle skal med!**

I GW22 teller både rekke 1 og rekke 2 **100 %** av sine ordinære fantasy-poeng.

- Ingen ekstra multiplikator legges på individuelle spillerhendelser utover gjeldende C/VC-regler.
- Kaptein beholder ordinær ×2.
- Visekaptein beholder ordinær ×1,5 etter gjeldende regler.
- Personlige boostere skal ikke kunne aktiveres i Julebord-runden; dette må håndheves og kommuniseres tydelig i UI/regler.
- Ordinære lag-, klubb-, posisjons-, deadline- og snapshotregler gjelder med mindre annet eksplisitt dokumenteres.

Produkttekst kan presenteres omtrent slik:

> 🎄 JULEBORD – Alle skal med! Denne runden teller både rekke 1 og rekke 2 100 %. Sett sammen hele laget med omhu – ingen får sitte igjen hjemme mens førstelinja er på julebord.

## Hvorfor GW22

GW22 ligger i ønsket tidsrom tidlig i desember og gir en naturlig sesongmessig Event Week mellom Rik Onkel og Fattig Onkel. Endelig implementasjon skal verifisere GW22 mot den autoritative 45-runders produksjonskalenderen før eventtypen aktiveres.

## Sesongrytme

- GW15: **Rik Onkel** – 200m eventlag.
- GW22: **Julebord** – begge rekker teller 100 %.
- GW38: **Fattig Onkel** – 70m eventlag.

## Ferdigkriterier

Punktet kan først markeres ✅ når:

1. GW22 er verifisert mot autoritativ produksjonskalender.
2. Julebord er konfigurert i produksjonsdata/event-systemet.
3. Scoring håndterer 100 % poeng fra begge rekker uten å bryte ordinær C/VC-logikk.
4. Personlige boostere er blokkert i GW22.
5. Deadline og snapshot fryser korrekt Julebord-lag/regler.
6. Fantasy-kalender, lagbygger og regler viser Julebord tydelig.
7. Rundehistorikk/statistikk kan identifisere Julebord-runden korrekt.
8. Regresjonstester dekker scoring, boosterkonflikt, snapshot og historikk.

Dette arbeidet eies av Chat 07 / MP-07, med scoringverifikasjon i MP-06 og regresjon i MP-12 ved behov.
