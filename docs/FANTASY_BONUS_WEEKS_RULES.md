# Stang Inn Fantasy – Boostere og Event Weeks 2026/27

> Autoritativ produktregel for personlige boostere og felles Event Weeks. Oppdatert i MP-14 launch-gate mot faktisk produksjonsimplementasjon og produksjonskonfigurasjon.

Sist verifisert: 2026-08-25

## Personlige boosterkort

Hvert fantasy-lag har én av hver personlig booster per sesong:

1. **Kapteinsboost** – kapteinen får ×2,5 i stedet for ordinær ×2 i valgt ordinær fantasy-runde.
2. **Rekkeboost** – rekke 2 teller 100 % i stedet for ordinær 50 % i valgt ordinær fantasy-runde.
3. **Bytteboost** – laget kan gjøre opptil 4 permanente spillerbytter foran valgt ordinær fantasy-runde i stedet for normalt 2.

Maks ett personlig boosterkort kan brukes i samme fantasy-runde. Et brukt kort kommer ikke tilbake. Boostere må velges før rundens autoritative deadline og kan ikke kombineres med en felles Event Week.

Bytteboost kan trekkes tilbake så lenge laget ikke har brukt mer enn den ordinære grensen på 2 transfers. Når transfer nummer 3 gjennomføres, er boosteren forpliktet til runden.

## Felles Event Weeks 2026/27

Sesongen har **tre** publiserte Event Weeks:

| Gameweek | Event | Regel |
| --- | --- | --- |
| GW15 | **Rik Onkel** | Separat midlertidig eventlag med 200m budsjett |
| GW22 | **Julebord – Alle skal med!** | Ordinært permanentlag brukes, men både rekke 1 og rekke 2 teller 100 % |
| GW38 | **Fattig Onkel** | Separat midlertidig eventlag med 70m budsjett |

Alle tre følger samme autoritative fantasy-deadline: første kampstart i runden. Permanente transfers og personlige boostere er sperret i Event Weeks.

### GW15 – Rik Onkel

- Separat eventlag med 200,0m budsjett.
- 12 spillere: 6F / 4D / 2G.
- To gyldige rekker, hver med 3F / 2D / 1G.
- Ordinær klubbgrense gjelder.
- Låste 2026/27-sesongpriser brukes.
- Kaptein ×2 og visekaptein ×1,5.
- Rekke 1 teller 100 %, rekke 2 teller 50 %.
- Eventlaget gjelder kun GW15 og overskriver aldri permanentlaget.

### GW22 – Julebord

**Alle skal med!**

- Det ordinære permanentlaget brukes; det opprettes ikke separat eventlag.
- Rekke 1 teller 100 %.
- Rekke 2 teller 100 %.
- Kaptein beholder ordinær ×2.
- Visekaptein beholder ordinær ×1,5.
- Personlige boostere og permanente transfers er sperret i GW22.
- Julebord-regelen fryses i rundens snapshot med effektiv rekke-2-multiplikator 1,00.

### GW38 – Fattig Onkel

- Separat eventlag med 70,0m budsjett.
- 12 spillere: 6F / 4D / 2G.
- To gyldige rekker, hver med 3F / 2D / 1G.
- Ordinær klubbgrense gjelder.
- Låste 2026/27-sesongpriser brukes.
- Kaptein ×2 og visekaptein ×1,5.
- Rekke 1 teller 100 %, rekke 2 teller 50 %.
- Eventlaget gjelder kun GW38 og overskriver aldri permanentlaget.

## Permanent lag, deadline og snapshots

Rik Onkel og Fattig Onkel bruker egne rundebundne eventlag. `fantasy_user_team_players` skal ikke overskrives, og eventvalg skal ikke registreres som permanente transfers. De permanente lagene bevares uendret gjennom Rik Onkel og Fattig Onkel, og brukeren går automatisk tilbake til sitt permanente lag etter Event Week. Julebord bruker permanentlaget direkte med snapshot-frosset rekke-2-override.

Alle boostere og Event Weeks følger fantasy-rundens autoritative `deadline_at`, som skal være første kampstart. Snapshotet er historisk fasit og fryser relevant roster, rekker, C/VC, priser, booster og/eller Event Week-metadata.

## Scoring

Event Weeks bruker samme autoritative poengkjede og sesongtotal som ordinære fantasy-runder: råpoeng → rekkevekting → C/VC → rundepoeng → leaderboard.

- Ordinær rekke 1: 100 %.
- Ordinær rekke 2: 50 %.
- Julebord rekke 2: 100 %.
- Kaptein: ×2, bortsett fra Kapteinsboost på ordinær runde.
- Visekaptein: ×1,5.

## Produksjonsstatus ved MP-14.1

Verifisert 2026-08-25 mot faktisk produksjonsdatabase og `main`:

- GW15 `rich_uncle`, 200m, publisert.
- GW22 `christmas_party`, publisert.
- GW38 `poor_uncle`, 70m, publisert.
- Produksjon håndhever konflikt mellom personlige boostere og Event Weeks.
- Permanente transfers er sperret i Event Weeks.
- Rik/Fattig bruker separate eventlag.
- Julebord fryser permanentlaget med rekke 2 = 100 %.

Denne filen erstatter eldre formuleringer om at sesongen bare har to Event Weeks.