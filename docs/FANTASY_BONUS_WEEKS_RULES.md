# Stang Inn XI – Bonus Weeks 2026/27

> Regelspesifikasjon for MP-07.6. Denne filen er den avtalte produktregelen for Bonus Weeks før implementasjon. Eksisterende scoring-, transfer-, deadline- og snapshotlogikk skal ikke endres på en måte som bryter disse reglene.

Sist oppdatert: 2026-08-22

## Kort forklart for spillerne

I Stang Inn XI får hvert lag tre Bonus Weeks gjennom sesongen. Du bestemmer selv hvilke fantasy-runder du vil bruke dem i.

Du har én av hver:

1. **Kapteinsboost** – kapteinen din får **×2,5** i stedet for vanlig ×2 i den valgte fantasy-runden.
2. **Rekkeboost** – **rekke 2 teller 100 %** i stedet for vanlig 50 % i den valgte fantasy-runden.
3. **Bytteboost** – du kan gjøre **opptil 4 spillerbytter** foran den valgte fantasy-runden i stedet for normalt 2.

Hver booster kan brukes **én gang per sesong**, og du kan bruke **maks én booster i samme fantasy-runde**.

Bonus Weeks følger de vanlige fantasy-rundene. Har en spiller eller klubb 0, 1 eller flere kamper i runden, gjelder boosteren for det kampgrunnlaget som faktisk tilhører den autoritative fantasy-runden.

## Felles regler

- Hvert fantasy-lag får én Kapteinsboost, én Rekkeboost og én Bytteboost per sesong.
- Brukeren velger selv hvilken åpen fantasy-runde boosteren skal brukes i.
- Maks én booster kan være aktiv for laget i samme fantasy-runde.
- En booster kan ikke brukes på nytt etter at den er endelig brukt.
- Aktivering må skje før fantasy-rundens eksisterende `deadline_at`, altså første kampstart i runden.
- Kapteinsboost og Rekkeboost kan aktiveres, byttes eller trekkes tilbake frem til deadline.
- Etter deadline er valgt booster låst og kan ikke flyttes, endres eller slettes.
- Boostere kan ikke stables.
- Vanlige krav til gyldig lag, budsjett, klubbgrense, posisjoner, rekker, kaptein og visekaptein gjelder fortsatt.
- Double gameweeks er tillatt og er en bevisst del av strategien. Boosteren gjelder alle kamper som faktisk tilhører den aktuelle fantasy-runden.
- Hvis terminlisten endres før deadline, følger Bonus Week den autoritative fantasy-runden, ikke en opprinnelig kampdato brukeren så da boosteren ble valgt.
- Historiske Bonus Weeks skal være reproduserbare fra immutable snapshots og lagrede poengrader. Scoring skal aldri være avhengig av en senere endret live-aktivering.

## Kapteinsboost

### Effekt

Kapteinens multiplikator endres fra **×2,0 til ×2,5** i den valgte fantasy-runden.

Visekapteinen beholder vanlig **×1,5**.

Eksisterende rekkevekting gjelder før kapteinsmultiplikatoren:

- Rekke 1: 100 %
- Rekke 2: 50 %
- Deretter Kapteinsboost ×2,5 dersom kapteinen spiller.

### Double gameweeks

Kapteinsboost er tillatt i runder der kapteinen har flere kamper. Alle råpoeng fra spillerens kamper i den autoritative fantasy-runden summeres før rekke- og kapteinsmultiplikator brukes.

Dette er et bevisst designvalg. Multiplikatoren er derfor ×2,5 og ikke ×3, for å begrense hvor dominerende én dobbelrunde kan bli over en sesong på 45 fantasy-runder.

### Aktivering og kansellering

Kapteinsboost kan aktiveres, flyttes til en annen åpen runde eller kanselleres frem til den aktuelle rundens deadline. Ved deadline fryses valget i snapshotet og boosteren regnes som brukt.

## Rekkeboost

### Effekt

Rekke 2 endres fra **50 % til 100 % poenguttelling** i den valgte fantasy-runden.

Rekke 1 fortsetter å telle 100 %.

Kaptein ×2 og visekaptein ×1,5 fungerer ellers som normalt og legges på etter rekkevektingen. Dersom kapteinen eller visekapteinen står på rekke 2, får spilleren derfor først 100 % via Rekkeboost og deretter sin vanlige C/VC-multiplikator.

### Hvorfor denne boosteren finnes

Stang Inn XI har to komplette hockeyrekker og ingen tradisjonell fantasy-benk. Rekkeboost er derfor Stang Inns egen variant av en «bench boost»: hele den andre rekken blir fullt tellende i én strategisk valgt fantasy-runde.

### Aktivering og kansellering

Rekkeboost kan aktiveres, flyttes til en annen åpen runde eller kanselleres frem til den aktuelle rundens deadline. Ved deadline fryses valget i snapshotet og boosteren regnes som brukt.

## Bytteboost

### Effekt

Lagets transfergrense økes fra **2 til 4 spillerbytter** foran den valgte fantasy-runden.

Byttene er permanente. Laget går ikke automatisk tilbake etter runden.

Alle vanlige regler gjelder fortsatt:

- 12 spillere totalt
- 6 forwards, 4 backer og 2 keepere
- to gyldige rekker med 3F / 2D / 1G
- ordinært sesongbudsjett
- ordinær klubbgrense
- ordinære låste sesongpriser

Bytteboost gir ikke ekstra budsjett og opphever ikke andre lagregler.

### Aktivering og kansellering

Bytteboost kan aktiveres før deadline. Den kan trekkes tilbake så lenge laget ikke har brukt mer enn den ordinære grensen på 2 spillerbytter i runden.

Så snart spillerbytte nummer 3 gjennomføres, er Bytteboost **forpliktet** til den runden og kan ikke kanselleres eller flyttes. Eventuelt fjerde bytte kan deretter gjennomføres før deadline.

Ved deadline fryses boosteren som brukt for runden.

## Deadline og snapshot

Bonus Weeks bruker samme deadline som laget og transferflyten: første kampstart i den kalenderbaserte fantasy-runden.

Snapshotet skal være historisk fasit. Når en runde fryses, skal snapshotet lagre nok informasjon til å reprodusere reglene som faktisk gjaldt for laget i runden, minst:

- hvilken booster som var aktiv
- effektiv kapteinsmultiplikator dersom Kapteinsboost var aktiv
- effektiv rekke-2-multiplikator dersom Rekkeboost var aktiv
- relevant transferregel/bruk for Bytteboost

Scoring av en historisk runde skal lese det frosne regelgrunnlaget og ikke en levende brukerinnstilling.

## Scoring

Bonus Weeks skal bygges inn i den eksisterende autoritative poengkjeden. Det skal ikke lages en separat bonuspoengmotor eller en separat leaderboard-total.

Normal rekkefølge er:

1. spillerens rå fantasy-poeng fra alle kamper i fantasy-runden
2. rekkevekting
3. C/VC-multiplikator, inkludert eventuell Kapteinsboost
4. lagets lagrede rundepoeng
5. eksisterende leaderboard/ranking

For Rekkeboost er eneste scoringsoverstyring at rekke 2 bruker 1,00 i stedet for 0,50.

For Kapteinsboost er eneste scoringsoverstyring at kapteinen bruker 2,50 i stedet for 2,00.

Bytteboost påvirker ikke poengformelen direkte.

## Leaderboard og rundehistorikk

Bonuspoengene inngår i ordinære `fantasy_team_round_points.total_points`. Leaderboardet skal derfor fortsatt bruke én autoritativ rundesum og én sesongtotal.

For å gjøre konkurransen forståelig skal UI vise når en booster er brukt:

- Rundehistorikken viser boosterens navn på den aktuelle runden.
- Rundedetaljen forklarer effekten, for eksempel «Kapteinsboost · C ×2,5» eller «Rekkeboost · Rekke 2 teller 100 %».
- Runde-/konkurransevisning skal kunne vise et kompakt boostermerke ved laget, slik at høye rundesummer er forståelige for andre spillere.
- Hoved-leaderboardet trenger ikke egne permanente kolonner for hver booster; den ordinære totalen er fortsatt fasit.

## UI og formidling

Bonus Weeks skal forklares på vanlig norsk og ikke forutsette kjennskap til andre fantasyspill.

På «Mitt lag» skal brukeren kunne se:

- hvilke tre boostere som finnes
- en kort énlinjeforklaring på hver booster
- om boosteren er tilgjengelig, valgt for en runde eller allerede brukt
- hvilken fantasy-runde som er valgt
- rundens deadline
- tydelig konsekvens før aktivering
- tydelig bekreftelse før en booster blir forpliktet når handlingen ikke lenger kan reverseres

Anbefalt korttekst i UI:

- **Kapteinsboost:** «Kapteinen får ×2,5 denne runden. Gjelder alle kampene hans i fantasy-runden.»
- **Rekkeboost:** «Rekke 2 teller 100 % denne runden i stedet for 50 %.»
- **Bytteboost:** «Gjør opptil 4 spillerbytter denne runden i stedet for 2. Byttene er permanente.»

Ved runder med flere kamper skal UI ikke skjule dette. Brukeren skal kunne se motstanderne gjennom eksisterende gameweek-fixturevisning før booster velges.

## Bevisst utelatt i første versjon

Følgende mekanikker innføres ikke i MP-07.6 for 2026/27:

- Triple Captain ×3
- klassisk Bench Boost
- Free Hit / midlertidig engangslag
- Wildcard med ubegrensede permanente transfers
- Limitless / Rik Onkel uten budsjettgrense
- posisjonsspesifikke doble poeng
- flere eksemplarer av samme booster

Dette holder systemet forståelig, balansert og testbart, og unngår parallelle lagtilstander som kan komplisere deadline-, snapshot- og transferarkitekturen.

## Implementeringsrekkefølge

MP-07.6 implementeres i avgrensede steg:

1. **07.6A – Regler:** denne regelspesifikasjonen låses før kodeendringer.
2. **07.6B – Datamodell:** booster inventory/aktivering, constraints og RLS.
3. **07.6C – Aktivering:** sikker RPC/API med deadline- og kanselleringsregler.
4. **07.6D – Snapshot:** booster fryses immutabelt sammen med laget.
5. **07.6E – Kapteinsboost:** ×2,5 i autoritativ scoring, inkludert double-GW-test.
6. **07.6F – Rekkeboost:** rekke 2 = 100 %, inkludert C/VC-kombinasjonstest.
7. **07.6G – Bytteboost:** transfergrense 2 → 4 og irreversibilitet etter tredje bytte.
8. **07.6H – Mitt lag/UI:** aktivering, status, forklaring og mobil/desktop.
9. **07.6I – Rundehistorikk/konkurranse:** boostermerker og forklarbar score.
10. **07.6J – Regresjon:** isolerte tester for deadline, snapshot, scoring, transfers og leaderboard.
11. **07.6K – Produksjonsverifisering:** build/CI og produksjonssmoke før MP-07.6 markeres ferdig.

## Akseptansekriterier

MP-07.6 er ikke ferdig før:

- alle tre boostere håndheves server-side
- ingen booster kan brukes etter deadline
- ingen lag kan stable boostere i samme runde
- hver booster kan brukes maksimalt én gang per sesong
- Kapteinsboost fungerer korrekt ved 0, 1 og flere kamper
- Rekkeboost fungerer korrekt sammen med rekke 1/2, C og VC
- Bytteboost kan ikke omgå ordinær lagvalidering
- snapshotet alene inneholder nødvendig historisk boosterregel
- re-scoring gir deterministisk samme resultat
- leaderboard summerer booster-runder uten separat spesialtotal
- brukerflaten forklarer reglene før aktivering
- rundehistorikken viser hvilken booster som ble brukt
- mobil og desktop er verifisert
- isolerte tester endrer ikke ekte 2026/27-data
- build/CI er grønn
- produksjon er smoke-testet før punktet markeres ✅
