# Stang Inn XI – Bonus Weeks 2026/27

> Regelspesifikasjon for MP-07.6. Denne filen er den avtalte produktregelen for Bonus Weeks og felles Event Weeks før implementasjon. Eksisterende scoring-, transfer-, deadline- og snapshotlogikk skal ikke endres på en måte som bryter disse reglene.

Sist oppdatert: 2026-08-22

## Kort forklart for spillerne

Stang Inn XI har to typer sesongmekanikker:

1. **Personlige boosterkort** – tre kort som hvert lag selv bestemmer når de vil bruke.
2. **Felles Event Weeks** – to spesielle fantasy-runder som gjelder alle lag samtidig.

### Personlige boosterkort

Hvert lag har én av hver:

1. **Kapteinsboost** – kapteinen får **×2,5** i stedet for vanlig ×2 i den valgte fantasy-runden.
2. **Rekkeboost** – **rekke 2 teller 100 %** i stedet for vanlig 50 % i den valgte fantasy-runden.
3. **Bytteboost** – laget kan gjøre **opptil 4 spillerbytter** foran den valgte fantasy-runden i stedet for normalt 2.

Hvert kort kan brukes én gang per sesong. Maks ett personlig boosterkort kan brukes i samme fantasy-runde.

### Felles Event Weeks

Sesongen får to annonserte eventrunder som gjelder alle:

- **Rik Onkel** – planlegges omtrent i november. Alle bygger et midlertidig lag med **200 millioner** i budsjett for kun denne fantasy-runden.
- **Fattig Onkel** – planlegges omtrent i februar. Alle bygger et midlertidig lag med **70 millioner** i budsjett for kun denne fantasy-runden.

Etter begge eventrundene kommer brukerens ordinære 100m-lag automatisk tilbake nøyaktig slik det var før eventrunden. Eventlaget skal aldri overskrive det permanente laget.

## Felles regler for personlige boosterkort

- Hvert fantasy-lag får én Kapteinsboost, én Rekkeboost og én Bytteboost per sesong.
- Brukeren velger selv hvilken åpen fantasy-runde kortet skal brukes i.
- Maks ett personlig boosterkort kan være aktivt i samme fantasy-runde.
- Et brukt kort kommer ikke tilbake.
- Aktivering må skje før rundens eksisterende `deadline_at`, altså første kampstart.
- Kapteinsboost og Rekkeboost kan aktiveres, flyttes eller trekkes tilbake frem til deadline.
- Etter deadline er valgt kort låst.
- Boosterkort kan ikke stables.
- Personlige boosterkort kan **ikke brukes i Rik Onkel- eller Fattig Onkel-runden**. Eventrundene står alene og skal være like for alle.
- Double gameweeks er tillatt. Boosteren gjelder alle kamper som faktisk tilhører den autoritative fantasy-runden.
- Historiske boosterregler skal kunne reproduseres fra immutable snapshots.

## Kapteinsboost

Kapteinens multiplikator endres fra **×2,0 til ×2,5** i den valgte fantasy-runden. Visekapteinen beholder ×1,5.

Eksisterende rekkevekting gjelder først: rekke 1 = 100 %, rekke 2 = 50 %. Deretter brukes kapteinsmultiplikatoren.

Kapteinsboost er tillatt i double gameweeks. Alle råpoeng fra kapteinens kamper i runden summeres før multiplikatorene brukes. ×2,5 er valgt i stedet for ×3 for å begrense hvor dominerende én dobbelrunde kan bli.

Kapteinsboost kan kanselleres eller flyttes frem til deadline. Ved deadline fryses valget i snapshotet og kortet regnes som brukt.

## Rekkeboost

Rekke 2 endres fra **50 % til 100 % poenguttelling** i den valgte fantasy-runden. Rekke 1 fortsetter på 100 %. Kaptein ×2 og visekaptein ×1,5 fungerer ellers normalt etter rekkevektingen.

Stang Inn XI har to komplette hockeyrekker og ingen tradisjonell fantasy-benk. Rekkeboost er derfor Stang Inns hockeyvariant av en bench boost.

Rekkeboost kan kanselleres eller flyttes frem til deadline. Ved deadline fryses valget i snapshotet og kortet regnes som brukt.

## Bytteboost

Lagets transfergrense økes fra **2 til 4 spillerbytter** foran den valgte fantasy-runden. Byttene er permanente og ordinært 100m-budsjett, klubbgrense, posisjoner, rekker og låste sesongpriser gjelder fortsatt.

Bytteboost kan trekkes tilbake så lenge laget ikke har brukt mer enn den ordinære grensen på 2 bytter. Når bytte nummer 3 gjennomføres, er kortet forpliktet til runden.

## Event Week 1 – Rik Onkel

### Spillerregel

**Én runde. 200 millioner. Bygg drømmelaget.**

I den annonserte Rik Onkel-runden får alle brukere bygge et eget midlertidig eventlag med budsjettgrense **200,0m**.

- Eventlaget har 12 spillere: 6F / 4D / 2G.
- Det skal fortsatt bestå av to gyldige rekker med 3F / 2D / 1G.
- Ordinær klubbgrense beholdes.
- Spillernes låste sesongpriser brukes.
- Kaptein ×2 og visekaptein ×1,5 gjelder normalt.
- Rekke 1 teller 100 %, rekke 2 teller 50 %.
- Personlige boosterkort kan ikke brukes samtidig.
- Eventlaget kan redigeres fritt frem til eventrundens ordinære deadline.
- Eventlaget gjelder kun Rik Onkel-runden.

### Permanent lag skal ikke endres

Når Rik Onkel starter, skal brukerens ordinære lag ligge urørt i bakgrunnen. Eventlaget er en separat, rundebundet lagtilstand og skal ikke registreres som permanente transfers.

Ved deadline snapshots Rik Onkel-laget som rundens autoritative lag. Etter eventrunden går brukeren automatisk tilbake til sitt ordinære lag med samme spillere, rekker, kaptein og visekaptein som før eventrunden. Ordinært budsjett er fortsatt 100m.

## Event Week 2 – Fattig Onkel

### Spillerregel

**Én runde. 70 millioner. Finn de beste kuppene.**

I den annonserte Fattig Onkel-runden får alle brukere bygge et eget midlertidig eventlag med budsjettgrense **70,0m**.

- Eventlaget har 12 spillere: 6F / 4D / 2G.
- Det skal fortsatt bestå av to gyldige rekker med 3F / 2D / 1G.
- Ordinær klubbgrense beholdes.
- Spillernes låste sesongpriser brukes.
- Kaptein ×2 og visekaptein ×1,5 gjelder normalt.
- Rekke 1 teller 100 %, rekke 2 teller 50 %.
- Personlige boosterkort kan ikke brukes samtidig.
- Eventlaget kan redigeres fritt frem til eventrundens ordinære deadline.
- Eventlaget gjelder kun Fattig Onkel-runden.

### Automatisk retur til 100m-laget

Fattig Onkel skal **ikke** tvinge brukerens permanente lag ned til 70m og skal ikke selge eller kjøpe spillere på det permanente laget.

Brukeren bygger i stedet et separat 70m-eventlag. Ved deadline snapshots dette laget for Fattig Onkel-runden. Når runden er over, vises og brukes automatisk det ordinære laget igjen med **100m ordinær budsjettgrense og nøyaktig samme permanente lagtilstand som før Fattig Onkel**.

Dermed trenger systemet ingen risikabel «restore»-operasjon som forsøker å kjøpe tilbake spillere etter eventet; permanentlaget ble aldri endret.

## Event Week-arkitektur

Rik Onkel og Fattig Onkel skal bruke samme tekniske fundament med ulik `event_budget`.

En eventrunde trenger minst:

- eventtype (`rich_uncle` / `poor_uncle`)
- autoritativ `round_id`
- eventbudsjett (200,0 / 70,0)
- separat eventroster per bruker/lag
- egne rekker, kaptein og visekaptein for eventlaget
- deadline-status
- snapshot som identifiserer eventtype og eventbudsjett

Det permanente `fantasy_user_team_players`-laget skal ikke overskrives når eventlaget redigeres. Dette er den viktigste sikkerhetsregelen for begge eventene.

Eventrunden følger autoritativ fantasy-kalender. Hvis kamper flyttes før deadline, følger eventet den valgte `round_id` og alle kampene som faktisk tilhører den runden.

## Deadline og snapshot

Alle boosterkort og Event Weeks bruker samme autoritative deadline som fantasy-runden: første kampstart.

Snapshotet skal være historisk fasit. Det må lagre nok informasjon til å vite:

- om runden var ordinær, Rik Onkel eller Fattig Onkel
- eventbudsjettet dersom runden var en Event Week
- hvilket midlertidig eventlag som faktisk ble brukt
- eventuell personlig booster på ordinære runder
- effektiv kapteinsmultiplikator ved Kapteinsboost
- effektiv rekke-2-multiplikator ved Rekkeboost
- relevant transferregel ved Bytteboost

Scoring av historiske runder skal lese frosset snapshot og aldri være avhengig av senere live-lag eller live-eventinnstillinger.

## Scoring og leaderboard

Det skal ikke lages en separat poengmotor eller separat sesongtotal for Event Weeks.

Eventlaget snapshots inn i den eksisterende autoritative rundescoringen. Rundens `fantasy_team_round_points.total_points` inngår deretter i sesongtotal, runderanking, movement og leaderboard på vanlig måte.

Rik Onkel og Fattig Onkel endrer **lagutvalget/budsjettet**, ikke selve poengformelen.

Normal scoring er fortsatt råpoeng → rekkevekting → C/VC → rundepoeng → leaderboard.

## UI og formidling

Reglene skal forklares på vanlig norsk før brukeren gjør endringer.

### Personlige boosterkort

- **Kapteinsboost:** «Kapteinen får ×2,5 denne runden. Gjelder alle kampene hans i fantasy-runden.»
- **Rekkeboost:** «Rekke 2 teller 100 % denne runden i stedet for 50 %.»
- **Bytteboost:** «Gjør opptil 4 spillerbytter denne runden i stedet for 2. Byttene er permanente.»

### Rik Onkel

Anbefalt hovedtekst:

**Rik Onkel – 200 millioner**

«Bygg drømmelaget for denne runden med 200 millioner. Laget gjelder bare Rik Onkel-runden. Når runden er over, kommer det vanlige laget ditt automatisk tilbake.»

UI skal samtidig vise brukerens ordinære lag som trygt bevart og forklare at eventvalgene ikke teller som permanente transfers.

### Fattig Onkel

Anbefalt hovedtekst:

**Fattig Onkel – 70 millioner**

«Du har bare 70 millioner til å bygge laget denne runden. Finn de beste kuppene. Når runden er over, kommer 100-millionerslaget ditt automatisk tilbake akkurat slik det var før Fattig Onkel.»

Dette budskapet skal vises tydelig både når eventlaget åpnes og før det lagres.

### Rundehistorikk og konkurranse

Rundehistorikken skal merke eventrunder tydelig, for eksempel:

- `Runde 12 · RIK ONKEL · 94,5 p`
- `Runde 34 · FATTIG ONKEL · 71,0 p`

Rundedetaljen skal kunne vise eventbudsjett og laget som faktisk scoret poengene. Leaderboardet bruker fortsatt ordinær total.

## Implementeringsrekkefølge

MP-07.6 implementeres i avgrensede steg:

1. **07.6A – Regler:** denne spesifikasjonen, inkludert personlige boosterkort og Rik/Fattig Onkel, låses før produksjonslogikk endres.
2. **07.6B – Datamodell:** booster inventory/aktivering + felles Event Week-konfigurasjon + separat eventroster, constraints og RLS.
3. **07.6C – Aktivering:** sikre booster-RPC-er med deadline/kansellering og sperre i Event Weeks.
4. **07.6D – Eventlag:** sikker oppretting/lagring av midlertidig 200m/70m-lag uten å endre permanentlaget.
5. **07.6E – Snapshot:** velg korrekt ordinært/eventlag og frys booster/event metadata immutabelt.
6. **07.6F – Kapteinsboost:** ×2,5 i autoritativ scoring, inkludert double-GW-test.
7. **07.6G – Rekkeboost:** rekke 2 = 100 %, inkludert C/VC-test.
8. **07.6H – Bytteboost:** transfergrense 2 → 4 og irreversibilitet etter tredje bytte.
9. **07.6I – Event Week UI:** Rik/Fattig Onkel-lagbygger, tydelig midlertidighet og budsjett.
10. **07.6J – Booster UI:** aktivering/status/forklaringer på Mitt lag.
11. **07.6K – Rundehistorikk/konkurranse:** booster- og eventmerker og forklarbar score.
12. **07.6L – Regresjon:** isolerte tester for permanentlag-bevaring, deadline, snapshots, scoring, transfers og leaderboard.
13. **07.6M – Produksjonsverifisering:** build/CI og produksjonssmoke før MP-07.6 markeres ferdig.

## Akseptansekriterier

MP-07.6 er ikke ferdig før:

- alle tre personlige boosterkort håndheves server-side
- hvert personlig kort kan brukes maksimalt én gang per sesong
- ingen kort kan brukes etter deadline eller stables
- personlige kort er sperret i Rik/Fattig Onkel-rundene
- Rik Onkel bruker separat 200m-eventlag
- Fattig Onkel bruker separat 70m-eventlag
- eventlag kan aldri overskrive eller generere permanente transfers på ordinærlaget
- etter begge eventer er ordinærlaget identisk med permanentlaget før eventrunden
- eventlag håndhever 12 spillere, posisjoner, to rekker og klubbgrense
- eventlag snapshots og scores gjennom samme autoritative poengkjede
- Kapteinsboost fungerer ved 0, 1 og flere kamper
- Rekkeboost fungerer korrekt med C/VC
- Bytteboost kan ikke omgå ordinær lagvalidering
- historiske snapshots inneholder nødvendig booster-/eventregel
- re-scoring gir deterministisk samme resultat
- leaderboard summerer event- og boosterrunder uten separat spesialtotal
- UI forklarer tydelig at Rik/Fattig Onkel-lag er midlertidige
- rundehistorikken viser booster/eventtype
- mobil og desktop er verifisert
- isolerte tester endrer ikke ekte 2026/27-data
- build/CI er grønn
- produksjon er smoke-testet før punktet markeres ✅
