# Sparta ut av EHL 2026/27

Status 2026-09-16: fase 1 er implementert, og produksjonsdata er korrigert og kontrollert. Koden leveres gjennom PR #90 og #91. Fase 2 avventer vedtatt terminliste. Dette addendumet overstyrer gamle forutsetninger om ti lag og 225 aktive kamper i launch-dokumentasjonen.

## Produksjonskontroll 2026-09-16

- 45 Sparta-kamper er annullert i både Tipping og Fantasy; 180 kamper gjenstår i den foreløpige kalenderen. Null aktive Sparta-kamper og null koblinger fra annullerte kamper til fantasy-runder.
- Alle fem innleverte Sparta-tips er bevart. Ingen poeng er tildelt.
- Tre tabelltips er konvertert til ni lag (27 rader). Sammenligning mot de arkiverte originalene viser identisk innbyrdes rekkefølge for gjenværende lag.
- Ingen Sparta-spillere er kjøpbare. 214 aktive current-roster-spillere er kjøpbare. De fem allerede eide Sparta-spillerne på fire fantasy-lag er beholdt; brukerne må velge erstatninger og lagre før fristen.
- Kontrollsummer før/etter er identiske for kamptips, brukerlagenes spillerinnhold, sesongpriser og alle 45 fantasy-runder. Første frist er fortsatt 2026-09-16 kl. 16:30 UTC / 18:30 norsk tid. Ingen tomme runder eller snapshots ved kontrollen.
- Originale kamp-/fantasy-rader og 45 rundepekere ligger i privat audit under `sparta-withdrawal-2026-27-fixture-alias-v2`. Tabelltips og spillerflagg ligger under `sparta-withdrawal-2026-27-v1`.
- Audit er ikke lesbar for anon/authenticated. Tabelltips må lagres gjennom den validerte RPC-en; direkte INSERT er stengt. RLS og sikkerhetsgrenser er kontrollert. Supabase Advisor sin INFO om audit uten klientpolicy er forventet for dette private arkivet; se [RLS-lint](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- `ehl_2026_27_format` står fortsatt på `pending`, med null for kampantall og `calendar_provisional=true`.

## To faser

1. Fjern Sparta fra aktiv konkurranse før første deadline. Bevar eksisterende tips, spilleridentitet, priser og historikk.
2. Når offisiell terminliste foreligger, kontroller og oppdater fremtidige kamper, fantasy-runder, deadlines og Event Weeks mot den vedtatte modellen.

| Serieformat | Kamper per klubb | Kamper totalt |
| --- | ---: | ---: |
| Fem møter mot hvert av åtte lag | 40 | 180 |
| Seks møter mot hvert av åtte lag | 48 | 216 |

Formatet er ikke valgt. At 180 kamper gjenstår i den gamle terminlisten etter at Sparta-kampene er annullert, er ikke en bekreftelse på 40-kampsserie. De 45 eksisterende fantasy-rundene beholdes foreløpig med samme ID og deadline. Antall seriekamper per klubb er ikke lik antall fantasy-runder.

## Konkurransereglene i fase 1

- **Tipping:** Sparta-kamper annulleres og forsvinner fra aktive lister. Innleverte tips bevares, vises under «Dine annullerte tips» og gir verken poeng, tap av streak eller utslag på treffprosent. Nye tips på annullerte kamper avvises på serveren.
- **Tabelltips:** Sparta fjernes fra eksisterende innleveringer. De ni andre lagene beholder innbyrdes rekkefølge og får plass 1–9. Originalene arkiveres privat. Brukerne kan endre frem til gjeldende frist. Serveren krever nøyaktig ni unike, aktive lag, også ved direkte RPC-kall.
- **Fantasy:** Sparta-spillere blir utilgjengelige i markedet. Eksisterende eide spillere slettes ikke. Lagbyggeren viser hvem som må erstattes, med en knapp som fjerner dem fra det ulagrede utkastet. Brukeren må velge erstatninger og lagre et gyldig lag. Vanlig fri lagbygging før første deadline gjelder; ingen automatisk spillerutvelgelse eller omprising. Uendrede lag kan fortsatt inneholde inaktive spillere ved deadline og disse har ingen tellende Sparta-kamper.
- **Spilleroverganger:** En bekreftet overgang til en aktiv EHL-klubb registreres på samme spiller-ID med eksisterende låst pris. Klubbgrenser må fortsatt valideres. Ingen overganger gjettes eller kjøres automatisk av denne migreringen.
- **Synk:** Databasetriggere hindrer at en gammel terminliste eller roster reaktiverer Sparta. Appens vanlige synk filtrerer også bort kampene. Historiske sesonger og andre klubber med Sparta i navnet omfattes ikke av kampfilteret.

## Kontrollgrunnlag før endring

Read-only kontroll av produksjon `ottyuonvnjblvficmymt` 2026-09-15:

- 225 sesongkamper, hvorav 45 Sparta-kamper; ingen ferdigspilte.
- Fem Sparta-tips fra fem brukere, ingen poeng.
- Tre fullstendige tabelltips med ti lag.
- Fire fantasy-lag eier til sammen fem Sparta-spillere.
- 25 kjøpbare Sparta-spillere; også historiske Sparta-aliaser i dagens spillerregister må deaktiveres.
- 45 åpne runder og null snapshots. Første fantasy-/tabelltipsfrist: 2026-09-16 16:30 UTC (18:30 norsk tid).
- Ingen fantasy-runder blir tomme etter at Sparta-kampene tas ut.

Dette er kontrolltall, ikke konstante krav til antall brukere eller innleveringer. Les på nytt rett før migrering.

## Publiseringsrekkefølge

1. Kontroller siste GitHub `main`, PR-diff, grønn CI/build og at en kompatibel appversjon kan publiseres. Nettleserkontroll dokumenteres separat; en kompilering erstatter ikke en visuell test.
2. Bekreft produksjonsprosjektet `ottyuonvnjblvficmymt`. Ta read-only kontroll av deadlines, snapshots, kamper, eierskap, priser og innleveringer. Ikke bruk syntetiske produksjonsdata.
3. Kjør `supabase/migrations/20260915101010_sparta_withdrawal_2026_27.sql` og deretter `supabase/migrations/20260915174852_sparta_fixture_alias_2026_27.sql` som registrerte migreringer. Begge er atomiske og har preseason-gater. Den andre inkluderer det bekreftede fulle kildenavnet. Originale berørte rader arkiveres i `competition_adjustment_audit` under nøklene oppgitt ovenfor. Begge er allerede kjørt i produksjon; ikke kjør gamle migreringer manuelt på nytt.
4. Kontroller 45 annullerte og 180 aktive kamper i den nåværende kalenderen, ni aktive tabellag, ni rader per innlevering, ingen kjøpbare Sparta-spillere og ingen koblinger mellom annullerte kamper og fantasy-runder. Bekreft uendrede priser, eide spillere, tips, snapshots og deadlines.
5. Publiser den verifiserte appversjonen umiddelbart etter migreringen. Ny kode krever de nye kolonnene; gammel tabelltips-UI forventer ti lag og skal ikke bli stående etter konvertering. Kontroller deployens commit og status.
6. Kontroller neste ordinære synk og produksjonsflatene. Ikke merk fase 1 produksjonsverifisert før faktisk migrering, deploy og etterkontroll er dokumentert.

## Feil og gjenoppretting

- Feiler migreringen før commit, rulles både skjema- og datadelen tilbake. Rett den konkrete feilen, test isolert og kontroller produksjonsstatus på nytt.
- Etter vellykket migrering skal appfeil helst rettes fremover med en kompatibel versjon. En ren tilbakerulling til ti-lagsappen passer ikke med ni-lagsdataene.
- Auditens `before_rows` inneholder originale kamper, fantasy-kamper/koblinger, spillerflagg, tabelltips, tabell og innstillinger. Audit er utilgjengelig for vanlige klienter. Ingen automatisk nedmigrering inngår: en blind gjenoppretting kan overskrive nye brukertips eller bekreftede spilleroverganger.
- Ved nødvendig datagjenoppretting: stans konkurransewrites/synk etter eksisterende driftsrutine, ta en ny backup, sammenlign audit med dagens rader, og lag en avgrenset transaksjon som bare reverserer feilaktige endringer. Test den på en isolert kopi før kjøring. Bevar senere brukerendringer og alle snapshots. Bruk `docs/MP01_PRODUCTION_RUNBOOK.md` for managed backup/recovery.

## Verifikasjon

Første produksjonsforsøk ble atomisk avvist fordi `fantasy_round_games` er en intern view, ikke en tabell. Ingen skjema- eller dataendringer ble stående. Migreringen er rettet til å nullstille koblingene på den autoritative `fantasy_games`-tabellen; viewen følger automatisk. Testen bruker nå den faktiske view-definisjonen fra MP-12-schema-bridge og kontrollerer at kampene bevares. Produksjonens objekttyper og relevante constraints er kontrollert eksplisitt.

Etter første vellykkede migrering viste etterkontrollen at kampkilden bruker `Sparta Ishockey Elite, IL - Ishockey - MEN 1`. Det navnet manglet i aliaslisten, slik at kampene fortsatt var aktive. Den separate fremovermigreringen legger til det eksakte navnet og arkiverer/annullerer kampene. Den er produksjonsverifisert 2026-09-16 med 45 annullerte kamper i begge produkter. Regresjonstesten bruker nå det faktiske kildenavnet, ikke bare et forkortet alias.

- `npm run test:sparta`: in-memory PostgreSQL/PGlite med syntetiske data. Kontrollerer atomisk avvisning etter sesongstart, idempotens, bevarte tips/eierskap/priser/deadlines, rangrekkefølge, RLS/RPC/deadline, gamle synkdata, streak/poeng og fri fantasy-erstatning før fristen. Ingen nettverk eller produksjonscredentials.
- Alle eksisterende `test:*`-skript og produksjonsbygg er kjørt lokalt uten feil.
- Lokal nettleserkontroll med syntetisk API: ni lag, endring og lagring av tabelltips, annullerte tips, blokkert kampformular og erstatning av Sparta-spiller til gyldig 12/12-lag er kontrollert. Ingen JavaScript-feil. Desktop 1440 px og mobil 390 px er kontrollert. Backendens fantasy-lagring er separat testet i PostgreSQL-testen, ikke mot produksjon.
- Begge produksjonsmigreringer er gjennomført. PR #90 har grønn CI/Vercel og er på `main`; publiseringsstatus for den siste navnekorreksjonen spores i PR #91. Innlogget produksjons-UI er ikke separat nettlesertestet i denne økten; brukerflytene er testet lokalt, mens produksjonsdata, privilegier og integritet er kontrollert direkte.

## Fase 2 når formatet er vedtatt

Valider offisiell kilde, 9 klubber, 40/48 kamper per klubb og 180/216 kamper totalt. Match eksisterende eksterne kamp-ID-er, bevar allerede leverte tips, og håndter flyttede/utgåtte kamper eksplisitt. Kontroller fordelingen av null/én/flere kamper per fantasy-runde og klubbenes hvileperioder. Gjennomgå deadlines, Bonus Weeks, Event Weeks og kalendertekst. Endre bare fremtidige, ulåste runder; historiske snapshots og poeng må ikke flyttes. Oppdater `ehl_2026_27_format` og fjern provisorisk merking først etter denne kontrollen.
