# Prismodell v4.1 – markedskalibrering

V4.1 bygger videre på v4 og legger til to kontroller som manglet i første versjon.

## 1. Kontinuerlig reprising-score

Den grove 5/15/60-prosentfunksjonen er erstattet av en kontinuerlig score fra 0–100. Scoren bruker gammel pris, PPG, antall kamper og posisjon. Billige etablerte gjennombrudd får høy score, mens lite kampgrunnlag demper signalet.

Scoren styrer hvor mye av modellens beregnede prisendring vi faktisk tar ut. Dermed blir prisendringene gradvise i stedet for å hoppe mellom tre faste nivåer.

## 2. Markedskalibrering mot 100m lagbudsjett

Et fantasyspill med uendret lagbudsjett kan ikke ha ukontrollert prisinflasjon i hele spillerbasen. V4.1 bruker derfor 25/26-markedets gjennomsnittspris som anker.

- Lagbudsjett: 100m.
- Råmodellen beregnes først per spiller.
- Gjennomsnittsprisen får maksimalt øke 3% fra 25/26-markedet.
- Hvis råmodellen ligger høyere, skaleres alle priser proporsjonalt ned før avrunding til 0,5m.
- Enkeltspillere kan fortsatt stige kraftig dersom andre spillere faller eller holdes igjen.

## Nye kolonner

- `Reprising-score`: kontinuerlig 0–100-signal på hvor utdatert 25/26-prisen ser ut.
- `% av 100m`: spillerens estimerte pris som andel av tilgjengelig lagbudsjett.
- `% av spillermarked`: spillerens andel av total estimert verdi for alle analyserte spillere.
- `Råmodell`: estimat før markedskalibrering.
- `V4.1 pris`: endelig markedskalibrert estimat.

## Diagnose

Siden 25/26-listen tidligere hadde snittpris rundt 8,5m, vil v4.1 ikke godta at 26/27-markedet bare driver oppover fordi mange spillere isolert sett fortjener prisøkning. Modellen tvinger fram en relativ prising: prisoppgang hos noen må balanseres av svakere prisutvikling hos andre.

Side: `/fantasy/diagnose/price-model-v4-1`
