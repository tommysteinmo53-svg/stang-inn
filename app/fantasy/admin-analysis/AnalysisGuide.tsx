export default function AnalysisGuide(){
 return <section className="xfp-panel">
  <div className="xfp-panel-head"><div><p className="eyebrow">SLIK LESER DU ANALYSEN</p><h2>Tall, signaler og formler</h2><p>Analysen skiller mellom observerte fakta, modellberegninger og prognoser. Scorene er beslutningsstøtte – ikke faktiske Fantasy-poeng.</p></div></div>
  <div className="fantasy-grid">
   <article className="fantasy-card"><h3>📊 Observerte fakta</h3><p>Faktiske Fantasy-poeng, sesong-PPG, form siste 3/5/10, hjemme/borte-resultater, pris, kampprogram og availability-status. Dette er historiske eller registrerte data – ikke prognoser.</p></article>
   <article className="fantasy-card"><h3>🧮 Modellberegninger</h3><p><strong>xFP</strong> bygges av sesongprestasjon, form, hjemme/borte og motstander. Standardvektene er 50/30/10/10, men kan justeres i admin. Motstanderratingen er dynamisk og fases gradvis fra preseason til live EHL-data.</p></article>
   <article className="fantasy-card"><h3>🔮 Prognoser</h3><p>xFP kamp og xFP 3 er forventede poeng framover. Availability legges på etter grunnprognosen: tilgjengelig 100 %, returning 85 %, questionable 60 %, ute/langtid/ikke i tropp 0 %.</p></article>
  </div>
  <div className="fantasy-grid">
   <article className="fantasy-card"><h3>🔥 Kjøpsscore 0–100</h3><p><strong>≥75 Sterkt kjøp · 60–74 Kjøp · 45–59 Vurder · &lt;45 Avvent.</strong></p><p>40 % xFP neste 3 · 25 % verdi per million · 15 % form mot sesongnivå · 10 % fixture · 10 % datatillit.</p></article>
   <article className="fantasy-card"><h3>🛡️ Holdscore 0–100</h3><p><strong>≥75 Klart HOLD · 60–74 HOLD · 45–59 Vurder · &lt;45 Svakt HOLD.</strong></p><p>35 % videre prognose · 20 % form/stabilitet · 15 % verdi · 10 % fixture · 15 % availability · 5 % datatillit. Sterk form straffes ikke; bare formfall trekker ned.</p></article>
   <article className="fantasy-card"><h3>⚠️ Salgsscore 0–100</h3><p><strong>≥70 Klart SELG · 55–69 SELG · 40–54 Vurder salg · &lt;40 Behold.</strong></p><p>Dette er en <strong>risikoscore</strong>: høyere er verre. 35 % svak prognose · 20 % formfall · 15 % svak verdi · 10 % tøff fixture · 15 % availability-risiko · 5 % datatillit.</p></article>
   <article className="fantasy-card"><h3>👑 Kapteinsscore 0–100</h3><p><strong>≥80 Elitekaptein · 65–79 Sterk · 50–64 Aktuell · &lt;50 Svak.</strong></p><p>55 % availability-justert xFP neste kamp · 20 % form · 15 % fixture · 10 % datatillit. Ingen kamp eller availability 0 gir kapteinsscore 0.</p></article>
  </div>
  <div className="fantasy-grid">
   <article className="fantasy-card"><h3>💰 Verdi per million</h3><p><strong>Verdi = availability-justert xFP / pris i millioner.</strong> En spiller med 24 xFP neste 3 og pris 8,0m har verdi 3,000 xFP per million. Prisvurderingen sammenligner verdien mot medianen for samme posisjon.</p></article>
   <article className="fantasy-card"><h3>🎯 Fixture-rating 1–5</h3><p><strong>1 svært vanskelig · 2 vanskelig · 3 nøytral · 4 lett · 5 svært lett.</strong> Underliggende faktor beholdes i xFP. Ratingen er presentasjonslaget som gjør matchupen lettere å forstå.</p></article>
   <article className="fantasy-card"><h3>✅ Datatillit</h3><p>Høy, middels eller lav datatillit beskriver hvor robust grunnlaget er. Spillere med for lite eller svakt datagrunnlag filtreres bort fra sentrale anbefalinger slik at modellen ikke later som den vet mer enn den gjør.</p></article>
  </div>
 </section>;
}
