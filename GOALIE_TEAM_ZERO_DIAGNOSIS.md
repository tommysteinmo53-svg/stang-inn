# Keeper SO: lag-nullkamp-diagnose

Denne branchen legger til en sikker diagnose som starter i lagets faktiske kamper med 0 baklengs.

Formål:
- finne nullkamper som mangler keeper-statistikkrad
- vise hvilken keeperrad/aktiv keeper som finnes i hver lag-nullkamp
- beholde HockeyLive som fasit
- ikke tvinge SO basert på diagnosen

Diagnosekoder:
- `KEEPER_AKTIV`: keepergruppen har en aktiv rad i nullkampen
- `KEEPERRAD_UTEN_AKTIVITET`: keeperrad finnes, men aktiv keeper kan ikke bekreftes
- `MANGLER_KEEPERRAD`: laget holdt nullen, men keepergruppen har ingen rad i kampen

Dette er laget for å avsløre hvorfor HockeyLive SO-total kan være høyere enn SO-kandidatene i importerte keeperrader.