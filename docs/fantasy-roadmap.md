# Fantasy Hockey – roadmap

## Mål

Bygge en egen fantasyhockey-modul i Stang Inn som erstatter manuell føring i regneark.

Systemet skal:

- hente kamper og resultater automatisk
- lagre spillere, priser og posisjoner
- beregne 19Fantasy-poeng per kamp
- vise form siste 3/5/10 kamper
- beregne verdi per million
- vise kommende kamper og fixture-rating
- foreslå kjøp / hold / selg
- foreslå kaptein
- optimalisere bytter innen budsjett og maks antall bytter
- estimere forventede poeng kommende runder

## Datakilder

Datakildene holdes adskilt fra fantasy-logikken slik at vi kan bytte leverandør senere.

1. HockeyLive sin offentlige terminliste/resultatstrøm brukes til kamper og resultater.
2. Offentlige HockeyLive/EHL-statistikksider brukes som fallback for spiller- og keeperstatistikk uten partner-token.
3. 19Fantasy-data brukes som egen importkilde dersom offentlig eller tillatt teknisk tilgang finnes, særlig for pris og eksakt W/C-posisjon.
4. Manuell admin-import beholdes som nødløsning for pris/posisjon hvis disse feltene ikke finnes offentlig.

### Offentlig fallback – prinsipp

Vi er ikke avhengige av NIF Data API-token. Fallback-importeren ligger isolert fra poengmotoren og prøver strukturerte data som er innebygd i de offentlige HockeyLive/EHL-sidene, med HTML-tabell som sekundær strategi. Et beskyttet diagnose-endepunkt brukes til å verifisere hvilke felter som faktisk er tilgjengelige før vi skriver dem til databasen.

## Faser

### v0.1 – Dashboard og datamodell

- fantasy-side i appen
- Supabase-tabeller for spillere, kamper, spiller-kampstatistikk og fantasy-poeng
- skille mellom faktiske poeng og modellens forventede poeng

### v0.2 – Automatisk kampdata

- synk av EHL-terminliste
- kampstatus og resultater
- kobling lag ↔ spillere
- daglig / kampnær synk via Vercel cron

### v0.3 – 19Fantasy-poengmotor

- konfigurerbare poengregler
- beregning per spiller per kamp
- summering per runde og sesong
- historikk slik at regelendringer kan spores

### v0.4 – Analyse

- poeng per kamp
- form 3 / 5 / 10
- hjemme/borte
- verdi per million
- motstander- og fixture-rating
- keeperanalyse

### v0.5 – Anbefalinger

- kjøp / hold / selg-score
- kapteinscore
- forventede poeng neste kamp / runde / 3 runder
- forklaring på hvorfor spilleren anbefales

### v0.6 – Lagoptimalisator

Input:

- nåværende lag
- tilgjengelig budsjett
- maks antall bytter
- eventuelle låste spillere

Output:

- anbefalte UT / IN
- ny lagverdi
- forventet poenggevinst
- risiko
- alternativt konservativt og offensivt forslag

## Prinsipp

Fantasy-poeng og anbefalinger skal aldri være hardkodet direkte i UI-et. Dataflyten skal være:

`datakilde -> normalisering -> database -> fantasy-poengmotor -> analysemodell -> UI`

Dette gjør systemet enklere å feilsøke og videreutvikle gjennom sesongen.
