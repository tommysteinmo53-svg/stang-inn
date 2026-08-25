# MP-07 – Julebord Event Week 2026/27

Dato: 2026-08-23
Sist produksjonsverifisert: 2026-08-25
Status: **PRODUKSJONSVERIFISERT**

## Beslutning

**Julebord er GW22 – torsdag 3. desember 2026.**

Julebord er den midterste av tre felles Event Weeks for Fantasy 2026/27 og er tydelig forskjellig fra Rik Onkel og Fattig Onkel.

## Regel

**JULEBORD – Alle skal med!**

I GW22 teller både rekke 1 og rekke 2 **100 %** av sine ordinære fantasy-poeng.

- Det ordinære permanentlaget brukes; Julebord oppretter ikke separat eventlag.
- Kaptein beholder ordinær ×2.
- Visekaptein beholder ordinær ×1,5.
- Personlige boostere kan ikke kombineres med Julebord.
- Permanente transfers er sperret mens GW22 er den aktive Event Week-runden.
- Ordinære lag-, klubb-, posisjons- og deadline-regler gjelder.
- Deadline er autoritativ `deadline_at` = første kampstart i GW22.
- Snapshotet fryser `christmas_party` og rekke-2-multiplikator 1,00 slik at historisk scoring kan reproduseres.

## Sesongrytme

- GW15: **Rik Onkel** – separat 200m-eventlag.
- GW22: **Julebord** – permanentlaget, begge rekker teller 100 %.
- GW38: **Fattig Onkel** – separat 70m-eventlag.

## Produksjonsverifikasjon

MP-14.1 kontrollerte 2026-08-25 faktisk produksjonsdatabase og produksjonsfunksjoner:

1. GW22 finnes i den autoritative 45-runders produksjonskalenderen.
2. `fantasy_event_weeks` har publisert `christmas_party` koblet til GW22.
3. Produksjonssnapshot bruker permanentlaget og setter `line2_multiplier_override = 1.00`.
4. Autoritativ scoringmotor bruker snapshot-override, mens C ×2 og VC ×1,5 beholdes.
5. Snapshot-gaten avviser personlige boostere i Julebord-runden.
6. Permanent transfer-RPC sperrer transfers i Event Weeks.
7. Brukersynlig regelbok viser GW22 og korrekt Julebord-regel.
8. Event Week-regresjonsdekning finnes i MP-07/MP-12-testene.

## Konklusjon

Ferdigkriteriene for MP-07.12 er oppfylt. Julebord er implementert og produksjonsverifisert. Videre endringer i regelen skal behandles som en eksplisitt produkt-/launch-endring og må re-verifiseres mot snapshots, scoring og Event Week-konflikter.