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
  <section className="team-builder-head"><div><p className="fantasy-kicker">STANG INN · FANTASY 2026/27</p><h1>Regler og poeng</h1><p>Alt du trenger å vite om lagbygging, fantasy-runder, bytter og hvordan spillerne tjener poeng.</p></div></section>

  <section className="rules-highlight-grid">
   <article className="team-panel"><span className="rules-icon">💰</span><h2>100 mill.</h2><p>Budsjett for hele laget. Spillerprisene er faste gjennom hele 2026/27-sesongen.</p></article>
   <article className="team-panel"><span className="rules-icon">👥</span><h2>12 spillere</h2><p>6 forwards, 4 backer og 2 keepere. Maks 3 spillere fra samme klubb.</p></article>
   <article className="team-panel"><span className="rules-icon">🔁</span><h2>2 bytter</h2><p>Maks to spillerbytter per fantasy-runde. Flytting mellom 1. og 2. rekke er gratis.</p></article>
   <article className="team-panel"><span className="rules-icon">👑</span><h2>C ×2 · VC ×1,5</h2><p>Kaptein dobler sine poeng. Visekaptein får 1,5 ganger poengene når han spiller.</p></article>
  </section>

  <section className="rules-section team-panel">
   <p className="eyebrow">LAGET DITT</p><h2>Lagregler</h2>
   <div className="rules-copy-grid">
    <div><h3>Oppstilling</h3><p>Laget består av to rekker. Hver rekke skal ha <strong>1 keeper, 2 backer og 3 forwards</strong>. Center og wing regnes begge som forwards.</p><p>Du kan flytte spillere fritt mellom 1. og 2. rekke så lenge begge rekkene fortsatt har riktig sammensetning. Rekkeendringer teller ikke som transfers.</p></div>
    <div><h3>Deadline og snapshot</h3><p>Hver fantasy-runde har deadline ved <strong>første kampstart i runden</strong>. Laget fryses automatisk på dette tidspunktet.</p><p>Flyttede EHL-kamper følger faktisk kampdato. Derfor kan en fantasy-runde ha ulikt antall kamper, og et lag kan ha 0, 1 eller flere kamper i samme fantasy-runde.</p></div>
    <div><h3>Bytter</h3><p>Etter sesongstart kan du gjøre maksimalt <strong>2 spillerbytter per fantasy-runde</strong>. Et tredje bytte blir blokkert.</p><p>Kaptein, visekaptein og rekkeplassering kan endres uten å bruke av byttekvoten, så lenge endringen lagres før deadline.</p></div>
    <div><h3>Priser</h3><p>Spillerprisene er <strong>låst for hele sesongen</strong>. Kjøps- og salgspris endres altså ikke etter form, popularitet eller poengproduksjon.</p><p>Summen av de 12 spillerne kan aldri overstige 100 millioner.</p></div>
   </div>
  </section>

  <section className="rules-section team-panel">
   <p className="eyebrow">UTESPELLERE</p><h2>Slik får forwards og backer poeng</h2>
   <div className="rules-table-wrap"><table className="rules-table"><thead><tr><th>Hendelse</th><th>Forward</th><th>Back</th><th>Keeper*</th><th>Forklaring</th></tr></thead><tbody>{skaterRows.map(r=><tr key={r.event}><td><strong>{r.event}</strong></td><td>{r.forward}</td><td>{r.defense}</td><td>{r.goalie}</td><td>{r.note}</td></tr>)}</tbody></table></div>
   <p className="rules-footnote">* Keeper kan også registreres med mål, assist, skudd, +/− og utvisningsminutter dersom slike hendelser finnes i kampdataene.</p>
  </section>

  <section className="rules-section team-panel">
   <p className="eyebrow">KEEPERE</p><h2>Ekstra keeperpoeng</h2>
   <div className="rules-table-wrap"><table className="rules-table rules-table-simple"><thead><tr><th>Hendelse</th><th>Poeng</th><th>Forklaring</th></tr></thead><tbody>{goalieRows.map(r=><tr key={r.event}><td><strong>{r.event}</strong></td><td>{r.points}</td><td>{r.note}</td></tr>)}</tbody></table></div>
   <div className="rules-callout"><strong>Keeper må faktisk ha spilt.</strong><span>En oppført reservekeeper med 0:00, 0 redninger og 0 baklengs får ikke deltakelses- eller keeperpoeng.</span></div>
  </section>

  <section className="rules-section team-panel">
   <p className="eyebrow">KAPTEIN</p><h2>Multiplikatorer</h2>
   <div className="rules-captain-grid"><article><span>C</span><div><strong>Kaptein ×2</strong><p>Har kapteinen 12 grunnpoeng i runden, teller han som 24 fantasy-poeng.</p></div></article><article><span>VC</span><div><strong>Visekaptein ×1,5</strong><p>Har visekapteinen 12 grunnpoeng, teller han som 18 fantasy-poeng.</p></div></article></div>
   <p className="team-muted">C og VC får sine respektive multiplikatorer samtidig dersom begge spiller. VC er ikke en ren fallback.</p>
  </section>

  <section className="rules-section team-panel">
   <p className="eyebrow">BONUSPOENG</p><h2>Special teams og faceoffs</h2>
   <div className="rules-table-wrap"><table className="rules-table rules-table-simple"><thead><tr><th>Hendelse</th><th>Ekstra poeng</th><th>Forklaring</th></tr></thead><tbody>{bonusRows.map(r=><tr key={r.event}><td><strong>{r.event}</strong></td><td>{r.points}</td><td>{r.note}</td></tr>)}</tbody></table></div>
   <p className="rules-footnote">PP- og SH-poengene er bonuspoeng. Et mål eller en assist i special teams gir derfor både ordinære mål-/assistpoeng og bonusen over. Vunnet dropp gir 0,25 poeng per seier.</p>
  </section>

  <section className="rules-section team-panel">
   <p className="eyebrow">EKSEMPEL</p><h2>Eksempel på spillerpoeng</h2>
   <div className="rules-example"><div><strong>Forward</strong><p>Spiller kampen (+2), scorer 1 mål (+10), har 1 assist (+6), 4 skudd (+4), +2 i +/- (+2) og 2 utvisningsminutter (−2).</p><b>Totalt: 22 poeng</b></div><div><strong>Samme spiller som kaptein</strong><p>22 grunnpoeng × 2.</p><b>Totalt til fantasylaget: 44 poeng</b></div><div><strong>Samme spiller som visekaptein</strong><p>22 grunnpoeng × 1,5.</p><b>Totalt til fantasylaget: 33 poeng</b></div></div>
  </section>
 </main>
}
