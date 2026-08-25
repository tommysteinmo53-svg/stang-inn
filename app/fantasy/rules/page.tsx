import "../fantasy.css";
import "./rules.css";

const skaterRows=[
 {event:"Deltakelse i kamp",forward:"+2",defense:"+2",goalie:"+2",note:"Gis når spilleren faktisk deltar."},
 {event:"Mål",forward:"+10",defense:"+15",goalie:"+15",note:"Per mål."},
 {event:"Assist",forward:"+6",defense:"+8",goalie:"+8",note:"Per assist."},
 {event:"Skudd på mål",forward:"+1",defense:"+1",goalie:"+1",note:"Per registrerte skudd."},
 {event:"+/−",forward:"±1",defense:"±1",goalie:"±1",note:"Én fantasy-poeng per registrerte pluss/minus."},
 {event:"Utvisningsminutt",forward:"−1",defense:"−1",goalie:"−1",note:"Per minutt, maksimalt −10 poeng per kamp."},
];
const goalieRows=[
 {event:"Redning",points:"+0,5",note:"1 fantasy-poeng per 2 redninger."},
 {event:"Baklengsmål",points:"−3",note:"Per registrerte baklengsmål."},
 {event:"Seier",points:"+5",note:"Når keeperen krediteres med seier."},
 {event:"Shutout",points:"+10",note:"Når keeperen spiller og holder nullen."},
];
const bonusRows=[
 {event:"Overtallsmål (PP)",points:"+2",note:"Ekstra bonus i tillegg til ordinære målpoeng."},
 {event:"Overtallsassist (PP)",points:"+1",note:"Ekstra bonus i tillegg til ordinære assistpoeng."},
 {event:"Undertallsmål (SH)",points:"+6",note:"Ekstra bonus i tillegg til ordinære målpoeng."},
 {event:"Undertallsassist (SH)",points:"+4",note:"Ekstra bonus i tillegg til ordinære assistpoeng."},
 {event:"Vunnet dropp",points:"+0,25",note:"Per vunnet dropp."},
];

export default function FantasyRulesPage(){
 return <main className="fantasy-shell fantasy-rules-shell">
  <section className="team-builder-head"><div><p className="fantasy-kicker">STANG INN · EHL 2026/27</p><h1>Regler</h1><p>Én samlet regelbok for Stang Inn Fantasy og Stang Inn Tipping.</p></div></section>

  <nav className="rules-product-nav" aria-label="Velg regelsett">
   <a href="#fantasy-rules"><span>FANTASY</span><strong>Lag, scoring og spesialrunder</strong></a>
   <a href="#tipping-rules"><span>TIPPING</span><strong>Kamptips, tabelltips og konkurranse</strong></a>
  </nav>

  <div className="rules-product-divider" id="fantasy-rules"><span>FANTASY</span><strong>Fantasy-regler 2026/27</strong></div>
  <section className="rules-highlight-grid">
   <article className="team-panel"><span className="rules-symbol">100M</span><h2>100 mill.</h2><p>Budsjett for hele laget. Spillerprisene er faste gjennom hele 2026/27-sesongen.</p></article>
   <article className="team-panel"><span className="rules-symbol">12</span><h2>12 spillere</h2><p>6 forwards, 4 backer og 2 keepere. Maks 3 spillere fra samme klubb.</p></article>
   <article className="team-panel"><span className="rules-symbol">2X</span><h2>2 bytter</h2><p>Maks to spillerbytter per fantasy-runde. Flytting mellom 1. og 2. rekke er gratis.</p></article>
   <article className="team-panel"><span className="rules-symbol">C</span><h2>C ×2 · VC ×1,5</h2><p>Kaptein dobler sine poeng. Visekaptein får 1,5 ganger poengene når han spiller.</p></article>
  </section>
  <section className="rules-section team-panel"><p className="eyebrow">LAGET DITT</p><h2>Lagregler</h2><div className="rules-copy-grid"><div><h3>Oppstilling</h3><p>Laget består av to rekker. Hver rekke skal ha <strong>1 keeper, 2 backer og 3 forwards</strong>. Center og wing regnes begge som forwards.</p><p>Du kan flytte spillere fritt mellom 1. og 2. rekke så lenge begge rekkene fortsatt har riktig sammensetning. Rekkeendringer teller ikke som transfers.</p></div><div><h3>Deadline og snapshot</h3><p>Hver fantasy-runde har deadline ved <strong>første kampstart i runden</strong>. Laget fryses automatisk på dette tidspunktet.</p><p>Flyttede EHL-kamper følger faktisk kampdato. Derfor kan en fantasy-runde ha ulikt antall kamper, og et lag kan ha 0, 1 eller flere kamper i samme fantasy-runde.</p></div><div><h3>Bytter</h3><p>Etter sesongstart kan du gjøre maksimalt <strong>2 spillerbytter per fantasy-runde</strong>. Et tredje bytte blir blokkert.</p><p>Kaptein, visekaptein og rekkeplassering kan endres uten å bruke av byttekvoten, så lenge endringen lagres før deadline.</p></div><div><h3>Priser</h3><p>Spillerprisene er <strong>låst for hele sesongen</strong>. Kjøps- og salgspris endres altså ikke etter form, popularitet eller poengproduksjon.</p><p>Summen av de 12 spillerne kan aldri overstige 100 millioner.</p></div></div></section>

  <section className="rules-section team-panel"><p className="eyebrow">EVENT WEEKS 2026/27</p><h2>Tre felles spesialrunder</h2><div className="rules-copy-grid">
   <div><h3>GW15 · Rik Onkel</h3><p>Du bygger et <strong>separat eventlag med 200 millioner</strong>. Eventlaget gjelder bare denne runden. Det ordinære 100m-laget ditt kommer tilbake uendret etterpå.</p><p>Vanlige permanente transfers og personlige boosterkort er sperret i runden.</p></div>
   <div><h3>GW22 · Julebord</h3><p><strong>«Alle skal med!»</strong> Du bruker det ordinære laget ditt, men både rekke 1 og rekke 2 teller <strong>100 %</strong>.</p><p>Kaptein er fortsatt ×2 og visekaptein ×1,5. Personlige boosterkort og permanente transfers er sperret.</p></div>
   <div><h3>GW38 · Fattig Onkel</h3><p>Du bygger et <strong>separat eventlag med 70 millioner</strong>. Det ordinære laget overskrives aldri og kommer tilbake uendret i neste runde.</p><p>Vanlige permanente transfers og personlige boosterkort er sperret i runden.</p></div>
   <div><h3>Felles for alle tre</h3><p>Samme autoritative fantasy-deadline gjelder: <strong>første kampstart i runden</strong>. Eventregelen fryses i snapshotet og kan ikke endres i ettertid.</p><p>Rik/Fattig bruker separate eventlag. Julebord bruker permanentlaget, men med 100 % uttelling for begge rekker.</p></div>
  </div><div className="rules-callout"><strong>Event Week-plan</strong><span>GW15: 12. november 2026 kl. 18:30 · GW22: 3. desember 2026 kl. 18:30 · GW38: 18. februar 2027 kl. 18:00. Tidene er norsk tid.</span></div></section>

  <section className="rules-section team-panel"><p className="eyebrow">UTESPELLERE</p><h2>Slik får forwards og backer poeng</h2><div className="rules-table-wrap"><table className="rules-table"><thead><tr><th>Hendelse</th><th>Forward</th><th>Back</th><th>Keeper*</th><th>Forklaring</th></tr></thead><tbody>{skaterRows.map(r=><tr key={r.event}><td><strong>{r.event}</strong></td><td>{r.forward}</td><td>{r.defense}</td><td>{r.goalie}</td><td>{r.note}</td></tr>)}</tbody></table></div><p className="rules-footnote">* Keeper kan også registreres med mål, assist, skudd, +/− og utvisningsminutter dersom slike hendelser finnes i kampdataene.</p></section>
  <section className="rules-section team-panel"><p className="eyebrow">KEEPERE</p><h2>Ekstra keeperpoeng</h2><div className="rules-table-wrap"><table className="rules-table rules-table-simple"><thead><tr><th>Hendelse</th><th>Poeng</th><th>Forklaring</th></tr></thead><tbody>{goalieRows.map(r=><tr key={r.event}><td><strong>{r.event}</strong></td><td>{r.points}</td><td>{r.note}</td></tr>)}</tbody></table></div><div className="rules-callout"><strong>Keeper må faktisk ha spilt.</strong><span>En oppført reservekeeper med 0:00, 0 redninger og 0 baklengs får ikke deltakelses- eller keeperpoeng.</span></div></section>
  <section className="rules-section team-panel"><p className="eyebrow">KAPTEIN</p><h2>Multiplikatorer</h2><div className="rules-captain-grid"><article><span>C</span><div><strong>Kaptein ×2</strong><p>Har kapteinen 12 grunnpoeng i runden, teller han som 24 fantasy-poeng.</p></div></article><article><span>VC</span><div><strong>Visekaptein ×1,5</strong><p>Har visekapteinen 12 grunnpoeng, teller han som 18 fantasy-poeng.</p></div></article></div><p className="team-muted">C og VC får sine respektive multiplikatorer samtidig dersom begge spiller. VC er ikke en ren fallback.</p></section>
  <section className="rules-section team-panel"><p className="eyebrow">BONUSPOENG</p><h2>Special teams og faceoffs</h2><div className="rules-table-wrap"><table className="rules-table rules-table-simple"><thead><tr><th>Hendelse</th><th>Ekstra poeng</th><th>Forklaring</th></tr></thead><tbody>{bonusRows.map(r=><tr key={r.event}><td><strong>{r.event}</strong></td><td>{r.points}</td><td>{r.note}</td></tr>)}</tbody></table></div><p className="rules-footnote">PP- og SH-poengene er bonuspoeng. Et mål eller en assist i special teams gir derfor både ordinære mål-/assistpoeng og bonusen over. Vunnet dropp gir 0,25 poeng per seier.</p></section>
  <section className="rules-section team-panel"><p className="eyebrow">KONKURRANSEN</p><h2>Fantasy-leaderboard og lik poengsum</h2><div className="rules-copy-grid"><div><h3>1. Totalpoeng</h3><p>Flest fantasy-poeng gjennom sesongen gir høyest plassering.</p></div><div><h3>2. Rundeseire</h3><p>Hvis to eller flere lag har lik totalpoengsum, rangeres laget med flest rundeseire foran.</p></div><div><h3>3. Beste runde</h3><p>Er lagene fortsatt like, rangeres laget med høyest enkelt-rundescore foran.</p></div><div><h3>Fortsatt helt likt?</h3><p>Hvis totalpoeng, rundeseire og beste runde er identisk, <strong>deler lagene plasseringen</strong>. Lagnavn brukes bare for stabil visningsrekkefølge og avgjør aldri konkurransen.</p></div></div><p className="rules-footnote">Samme tie-break-rekkefølge brukes når rankendring fra forrige scorede runde beregnes.</p></section>
  <section className="rules-section team-panel"><p className="eyebrow">EKSEMPEL</p><h2>Eksempel på spillerpoeng</h2><div className="rules-example"><div><strong>Forward</strong><p>Spiller kampen (+2), scorer 1 mål (+10), har 1 assist (+6), 4 skudd (+4), +2 i +/- (+2) og 2 utvisningsminutter (−2).</p><b>Totalt: 22 poeng</b></div><div><strong>Samme spiller som kaptein</strong><p>22 grunnpoeng × 2.</p><b>Totalt til fantasylaget: 44 poeng</b></div><div><strong>Samme spiller som visekaptein</strong><p>22 grunnpoeng × 1,5.</p><b>Totalt til fantasylaget: 33 poeng</b></div></div></section>

  <div className="rules-product-divider rules-tipping-divider" id="tipping-rules"><span>TIPPING</span><strong>Tipping-regler 2026/27</strong></div>
  <section className="rules-highlight-grid rules-tipping-highlights">
   <article className="team-panel"><span className="rules-symbol">5P</span><h2>Eksakt resultat</h2><p>Treffer du nøyaktig sluttresultat i kampen, får du 5 poeng.</p></article>
   <article className="team-panel"><span className="rules-symbol">3P</span><h2>Riktig utfall</h2><p>Riktig vinner eller riktig uavgjort, men feil sifre, gir 3 poeng.</p></article>
   <article className="team-panel"><span className="rules-symbol">0P</span><h2>Feil tips</h2><p>Feil kamputfall gir 0 poeng.</p></article>
   <article className="team-panel"><span className="rules-symbol">KO</span><h2>Låses ved kampstart</h2><p>Hvert kamptips kan endres frem til kampens registrerte starttidspunkt.</p></article>
  </section>

  <section className="rules-section team-panel"><p className="eyebrow">KAMPTIPS</p><h2>Slik fungerer tippingen</h2><div className="rules-copy-grid"><div><h3>Tips sluttresultatet</h3><p>Du setter antall mål til hjemme- og bortelaget. Tipset lagres per kamp og kan oppdateres så lenge kampen ikke er låst.</p></div><div><h3>Kampen låses</h3><p>Et kamptips låses automatisk når kampens registrerte starttidspunkt er nådd. Ferdigspilte kamper er alltid låst.</p></div><div><h3>Poeng</h3><p><strong>5 poeng</strong> for eksakte sifre, <strong>3 poeng</strong> for riktig kamputfall og <strong>0 poeng</strong> dersom utfallet er feil.</p></div><div><h3>Treffprosent</h3><p>Et treff er et tips som gir poeng. Treffprosenten beregnes fra scorede tips der du har truffet enten eksakt eller riktig kamputfall.</p></div></div></section>

  <section className="rules-section team-panel"><p className="eyebrow">STREAK</p><h2>Riktige tips på rad</h2><div className="rules-copy-grid"><div><h3>Aktiv streak</h3><p>Streaken øker for hver ferdigspilte kamp der tipset ditt gir mer enn 0 poeng.</p></div><div><h3>Streak brytes</h3><p>Et feil tips bryter streaken. En ferdigspilt kamp uten registrert tips bryter også rekken.</p></div><div><h3>Beste streak</h3><p>Stang Inn lagrer også den lengste sammenhengende rekken med riktige tips du har hatt i sesongen.</p></div><div><h3>Eksakt er også treff</h3><p>Både 5-poengere og 3-poengere teller som ett riktig tips i streaken.</p></div></div></section>

  <section className="rules-section team-panel"><p className="eyebrow">TIPPING-LEADERBOARD</p><h2>Sammenlagt og tie-break</h2><div className="rules-copy-grid"><div><h3>1. Poeng</h3><p>Spilleren med flest samlede tippepoeng ligger øverst.</p></div><div><h3>2. Eksakte resultater</h3><p>Ved lik poengsum rangeres spilleren med flest eksakte 5-poengere foran.</p></div><div><h3>3. Riktige kamputfall</h3><p>Er det fortsatt likt, rangeres spilleren med flest øvrige riktige kamputfall foran.</p></div><div><h3>Visningsrekkefølge</h3><p>Hvis konkurransetallene fortsatt er helt like, brukes navn som stabil visningsrekkefølge.</p></div></div></section>

  <section className="rules-section team-panel"><p className="eyebrow">TABELLTIPS</p><h2>Forutsi EHL-sluttabellen</h2><div className="rules-copy-grid"><div><h3>Ranger alle 10 lag</h3><p>Du setter en forventet sluttplassering fra 1 til 10 for hvert EHL-lag og lagrer hele tabelltipset før fristen.</p></div><div><h3>Hemmelig før fristen</h3><p>Før deadline ser hver spiller bare sitt eget tabelltips. Etter fristen åpnes de innleverte tipsene for innsyn.</p></div><div><h3>Plasseringsavvik</h3><p>Hvert lag får et avvik mellom din forventede plassering og faktisk EHL-plassering. Eksakt plassering gir avvik 0.</p></div><div><h3>Lavest avvik leder</h3><p>Tabelltips-stillingen rangeres etter <strong>lavest samlet plasseringsavvik</strong>. Scoren aktiveres når EHL-sesongen har startet og faktisk tabell finnes.</p></div></div><div className="rules-callout"><strong>Frist</strong><span>Den aktive tabelltipsfristen vises i Tipping → Tabelltips. Du kan lagre på nytt frem til fristen.</span></div></section>

  <section className="rules-section team-panel"><p className="eyebrow">MINILIGAER</p><h2>Samme liga på tvers av Stang Inn</h2><div className="rules-copy-grid"><div><h3>Én medlemskap</h3><p>Når du er med i en Stang Inn-miniliga, er medlemskapet felles for Fantasy og Tipping.</p></div><div><h3>Separate konkurranser</h3><p>Fantasy-poeng og tippepoeng beregnes fortsatt etter hvert sitt regelsett. Miniligaen samler deltakerne, men blander ikke poengmotorene.</p></div></div></section>
 </main>
}
