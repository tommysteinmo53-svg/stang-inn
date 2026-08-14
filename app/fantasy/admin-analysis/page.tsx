"use client";

import {useEffect,useMemo,useState} from "react";
import {getSupabaseBrowserClient} from "../../../lib/supabase";
import "../fantasy.css";

type Module={key:string;label:string;adminOnly:boolean};
type XfpRow={player_id:string;player_name:string;team:string;player_position:string;price:number;games_scored:number;season_ppg:number;form_ppg:number;venue_ppg:number;opponent:string|null;next_game_at:string|null;is_home:boolean|null;opponent_factor:number;next3_games:number;xfp_next_game:number;xfp_next3:number;value_next3:number;data_confidence:string};
type XfpSettings={season_weight:number;form_weight:number;venue_weight:number;opponent_weight:number;model_version:string;updated_at:string};
type SortKey="player_name"|"price"|"season_ppg"|"form_ppg"|"next_game_at"|"xfp_next_game"|"xfp_next3"|"value_next3"|"data_confidence";
type SortDir="asc"|"desc";

const details:Record<string,string>={
  recommendations:"🔥 Kjøp · ⚠️ Selg · 👑 Kaptein · 💎 Differensial · 📈 Formspiller · 💰 Beste verdi",
  "expected-points":"Historikk · motstander · hjemme/borte · form · kampprogram · pris/verdi",
  optimizer:"Beste lag innen 100m · 6F/4D/2G · maks 3 per klubb · senere 3–5 runders optimalisering",
  "transfer-assistant":"UT → INN-forslag · prisforskjell · forventet poenggevinst",
};

const pct=(v:number)=>Math.round(Number(v||0)*100);
const n=(v:unknown,d=2)=>Number(v||0).toFixed(d).replace(/\.00$/,".0");
const pos=(p:string)=>p==="C"||p==="W"?"F":p;
const confidenceRank=(v:string)=>v==="high"?3:v==="medium"?2:1;

export default function AdminAnalysisPage(){
  const[status,setStatus]=useState("Kontrollerer admin-tilgang …");
  const[allowed,setAllowed]=useState<boolean|null>(null);
  const[modules,setModules]=useState<Module[]>([]);
  const[token,setToken]=useState<string|null>(null);
  const[xfpRows,setXfpRows]=useState<XfpRow[]>([]),[xfpSettings,setXfpSettings]=useState<XfpSettings|null>(null),[xfpBusy,setXfpBusy]=useState(false),[xfpMsg,setXfpMsg]=useState("");
  const[seasonWeight,setSeasonWeight]=useState(50),[formWeight,setFormWeight]=useState(30),[venueWeight,setVenueWeight]=useState(10),[opponentWeight,setOpponentWeight]=useState(10);
  const[sort,setSort]=useState<SortKey>("xfp_next_game"),[sortDir,setSortDir]=useState<SortDir>("desc"),[teamFilter,setTeamFilter]=useState("ALL"),[posFilter,setPosFilter]=useState("ALL"),[q,setQ]=useState("");

  useEffect(()=>{(async()=>{
    try{
      const s=getSupabaseBrowserClient();
      if(!s)throw new Error("Supabase er ikke tilgjengelig");
      const{data}=await s.auth.getSession();
      const access=data.session?.access_token;
      if(!access)throw new Error("Du må være logget inn");
      setToken(access);
      const res=await fetch("/api/admin/fantasy/analysis-access",{headers:{Authorization:`Bearer ${access}`},cache:"no-store"});
      const body=await res.json();
      if(!res.ok||!body.ok){setAllowed(false);setStatus(body.error||"Ingen tilgang");return}
      setAllowed(true);setModules(body.modules||[]);setStatus("Admin-tilgang bekreftet på serveren");
    }catch(e:any){setAllowed(false);setStatus(e?.message||"Ingen tilgang")}
  })()},[]);

  async function loadXfp(access=token){
    if(!access)return;
    setXfpBusy(true);setXfpMsg("");
    try{
      const res=await fetch("/api/admin/fantasy/xfp",{headers:{Authorization:`Bearer ${access}`},cache:"no-store"});
      const body=await res.json();
      if(!res.ok||!body.ok)throw new Error(body.error||"Kunne ikke hente xFP");
      setXfpRows(body.rows||[]);setXfpSettings(body.settings||null);
      if(body.settings){setSeasonWeight(pct(body.settings.season_weight));setFormWeight(pct(body.settings.form_weight));setVenueWeight(pct(body.settings.venue_weight));setOpponentWeight(pct(body.settings.opponent_weight));}
    }catch(e:any){setXfpMsg(e?.message||"Kunne ikke hente xFP")}finally{setXfpBusy(false)}
  }
  useEffect(()=>{if(allowed&&token)loadXfp(token)},[allowed,token]);

  const totalWeight=seasonWeight+formWeight+venueWeight+opponentWeight;
  async function saveWeights(reset=false){
    if(!token)return;
    const values=reset?[50,30,10,10]:[seasonWeight,formWeight,venueWeight,opponentWeight];
    setXfpBusy(true);setXfpMsg("");
    try{
      const res=await fetch("/api/admin/fantasy/xfp",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({seasonWeight:values[0],formWeight:values[1],venueWeight:values[2],opponentWeight:values[3]})});
      const body=await res.json();if(!res.ok||!body.ok)throw new Error(body.error||"Kunne ikke lagre vektene");
      setXfpRows(body.rows||[]);setXfpSettings(body.settings||null);setSeasonWeight(values[0]);setFormWeight(values[1]);setVenueWeight(values[2]);setOpponentWeight(values[3]);setXfpMsg(reset?"Standardvekter gjenopprettet ✓":"Vekter lagret og xFP beregnet på nytt ✓");
    }catch(e:any){setXfpMsg(e?.message||"Kunne ikke lagre vektene")}finally{setXfpBusy(false)}
  }

  function setTableSort(key:SortKey){
    if(sort===key){setSortDir(v=>v==="desc"?"asc":"desc");return}
    setSort(key);
    setSortDir(key==="player_name"||key==="next_game_at"?"asc":"desc");
  }
  const arrow=(key:SortKey)=>sort===key?(sortDir==="asc"?" ↑":" ↓"):" ↕";

  const teams=useMemo(()=>Array.from(new Set(xfpRows.map(r=>r.team))).sort((a,b)=>a.localeCompare(b,"nb")),[xfpRows]);
  const shown=useMemo(()=>xfpRows.filter(r=>(teamFilter==="ALL"||r.team===teamFilter)&&(posFilter==="ALL"||pos(r.player_position)===posFilter)&&(!q||`${r.player_name} ${r.team}`.toLowerCase().includes(q.toLowerCase()))).sort((a,b)=>{
    let cmp=0;
    if(sort==="player_name")cmp=a.player_name.localeCompare(b.player_name,"nb");
    else if(sort==="next_game_at")cmp=(a.next_game_at?new Date(a.next_game_at).getTime():Number.MAX_SAFE_INTEGER)-(b.next_game_at?new Date(b.next_game_at).getTime():Number.MAX_SAFE_INTEGER);
    else if(sort==="data_confidence")cmp=confidenceRank(a.data_confidence)-confidenceRank(b.data_confidence);
    else cmp=Number(a[sort])-Number(b[sort]);
    return sortDir==="asc"?cmp:-cmp;
  }),[xfpRows,teamFilter,posFilter,q,sort,sortDir]);

  if(allowed===null)return <main className="fantasy-shell"><section className="fantasy-card"><h1>Fantasy analyse</h1><p>{status}</p></section></main>;
  if(!allowed)return <main className="fantasy-shell"><section className="fantasy-card"><p className="eyebrow">ADMIN ONLY</p><h1>Ingen tilgang</h1><p>{status}</p><p>Denne siden og tilhørende API-er er beskyttet med server-side admin-kontroll.</p></section></main>;

  return <main className="fantasy-shell">
    <section className="fantasy-hero"><div><p className="fantasy-kicker">STANG INN · ADMIN ANALYSE</p><h1>Fantasy-kommandosenter</h1><p className="fantasy-lead">Private analyse- og beslutningsverktøy. Vanlige fantasyspillere får ikke tilgang til modellene eller API-ene.</p></div><div className="fantasy-status"><span className="status-dot"/>Admin verifisert</div></section>

    <section className="fantasy-card" style={{marginTop:18}}>
      <div className="team-panel-top" style={{alignItems:"flex-start",gap:16,flexWrap:"wrap"}}><div><p className="eyebrow">ADMIN ONLY · xFP v1</p><h2>Forventede fantasy-poeng</h2><p className="card-copy">Juster modellen underveis. Endringer påvirker kun analyse og anbefalinger – aldri faktisk Fantasy-scoring.</p></div><button className="leaderboard-refresh" onClick={()=>loadXfp()} disabled={xfpBusy}>{xfpBusy?"Beregner …":"↻ Beregn på nytt"}</button></div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginTop:16}}>
        {[["Sesongprestasjon",seasonWeight,setSeasonWeight],["Form siste 5",formWeight,setFormWeight],["Hjemme/borte",venueWeight,setVenueWeight],["Motstander",opponentWeight,setOpponentWeight]].map(([label,value,setter]:any)=><label key={label} className="team-info-card" style={{display:"grid",gap:8}}><span>{label}</span><strong style={{fontSize:22}}>{value}%</strong><input type="range" min="0" max="100" step="5" value={value} onChange={e=>setter(Number(e.target.value))}/></label>)}
      </div>
      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",marginTop:14}}><strong>Sum: {totalWeight}%</strong><button className="team-save" style={{width:"auto"}} disabled={xfpBusy||totalWeight!==100} onClick={()=>saveWeights(false)}>Lagre vekter</button><button className="leaderboard-refresh" disabled={xfpBusy} onClick={()=>saveWeights(true)}>Tilbakestill 50/30/10/10</button>{xfpSettings&&<span className="team-muted">{xfpSettings.model_version} · sist endret {new Date(xfpSettings.updated_at).toLocaleString("nb-NO")}</span>}</div>
      {totalWeight!==100&&<p className="team-error">Vektene må summere til 100 % før de kan lagres.</p>}
      {xfpMsg&&<p className={xfpMsg.includes("✓")?"team-message":"team-error"}>{xfpMsg}</p>}
    </section>

    <section className="fantasy-card" style={{marginTop:18}}>
      <div className="leaderboard-section-head"><div><p className="eyebrow">MODELLRESULTAT</p><h2>xFP-rangering</h2></div><span className="team-muted">{shown.length} spillere</span></div>
      <div style={{display:"grid",gridTemplateColumns:"minmax(180px,1fr) repeat(2,minmax(130px,auto))",gap:10,marginTop:14}}>
        <input className="team-search" value={q} onChange={e=>setQ(e.target.value)} placeholder="Søk spiller eller lag …"/>
        <select className="team-line-select" value={teamFilter} onChange={e=>setTeamFilter(e.target.value)}><option value="ALL">Alle lag</option>{teams.map(t=><option key={t}>{t}</option>)}</select>
        <select className="team-line-select" value={posFilter} onChange={e=>setPosFilter(e.target.value)}><option value="ALL">Alle posisjoner</option><option value="F">Forward</option><option value="D">Back</option><option value="G">Keeper</option></select>
      </div>

      <div style={{overflowX:"auto",marginTop:14}}><table className="xfp-table" style={{width:"100%",borderCollapse:"collapse",minWidth:900}}><thead><tr>
        <th><button onClick={()=>setTableSort("player_name")}>Spiller{arrow("player_name")}</button></th>
        <th><button onClick={()=>setTableSort("price")}>Pris{arrow("price")}</button></th>
        <th><button onClick={()=>setTableSort("season_ppg")}>Sesong{arrow("season_ppg")}</button></th>
        <th><button onClick={()=>setTableSort("form_ppg")}>Form{arrow("form_ppg")}</button></th>
        <th><button onClick={()=>setTableSort("next_game_at")}>Neste{arrow("next_game_at")}</button></th>
        <th><button onClick={()=>setTableSort("xfp_next_game")}>xFP kamp{arrow("xfp_next_game")}</button></th>
        <th><button onClick={()=>setTableSort("xfp_next3")}>xFP 3{arrow("xfp_next3")}</button></th>
        <th><button onClick={()=>setTableSort("value_next3")}>Verdi{arrow("value_next3")}</button></th>
        <th><button onClick={()=>setTableSort("data_confidence")}>Data{arrow("data_confidence")}</button></th>
      </tr></thead><tbody>{shown.map(r=><tr key={r.player_id}><td><strong>{r.player_name}</strong><br/><small>{r.team} · {pos(r.player_position)}</small></td><td>{n(r.price,1)}m</td><td>{n(r.season_ppg)}</td><td>{n(r.form_ppg)}</td><td>{r.opponent?<><strong>{r.is_home?"vs":"@"} {r.opponent}</strong><br/><small>{r.next3_games} kamper / neste 3</small></>:"—"}</td><td><strong>{n(r.xfp_next_game)}</strong></td><td><strong>{n(r.xfp_next3)}</strong></td><td>{n(r.value_next3,3)}</td><td>{r.data_confidence==="high"?"🟢 Høy":r.data_confidence==="medium"?"🟡 Middels":"🔴 Lav"}<br/><small>{r.games_scored} kamper</small></td></tr>)}{!shown.length&&!xfpBusy&&<tr><td colSpan={9} style={{padding:20,textAlign:"center"}}>Ingen spillere matcher filtrene.</td></tr>}</tbody></table></div>
    </section>

    <section className="fantasy-grid" style={{marginTop:18}}>{modules.filter(m=>m.key!=="expected-points").map(m=><article className="fantasy-card" key={m.key}><p className="eyebrow">ADMIN ONLY</p><h2>{m.label}</h2><p className="card-copy">{details[m.key]}</p><p><strong>Status:</strong> bygges i neste fase.</p></article>)}</section>
    <section className="fantasy-card"><h2>Tilgangsregel</h2><p>xFP-endepunktet bruker <code>requireFantasyAdmin()</code>, og databasefunksjonene verifiserer i tillegg <code>players.admin=true</code>. Å skjule en knapp i nettleseren er ikke tilstrekkelig.</p><p><strong>{status}</strong></p></section>
  </main>;
}
