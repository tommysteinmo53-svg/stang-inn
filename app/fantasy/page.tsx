"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase";
import "./fantasy.css";

type CheckRow={name:string;team:string;position:string;goals:number;assists:number;shots:number;plusMinus:number;pim:number;saves:number;goalsAgainst:number;fantasyPoints:number};
type GoalDiag={index:number;result:string;scoringTeam?:string;scoringOrg?:string;homeIds?:number;awayIds?:number;fields?:Record<string,string>};
type PositionDiag={teamMemberRows:number;tournamentPlayerRows:number;teamMemberPositionValues:string[];tournamentPositionValues:string[]};
type ImportError={matchId:number;error:string};

const recommendations=[
 {label:"🔥 Kjøp",name:"Ingen data ennå",detail:"Aktiveres når spiller- og kampdata er synkronisert."},
 {label:"👑 Kaptein",name:"Ingen data ennå",detail:"Rangeres etter forventede poeng i neste runde."},
 {label:"⚠️ Selg",name:"Ingen data ennå",detail:"Basert på form, pris, kampprogram og forventede poeng."},
];

export default function FantasyPage(){
 const[allowed,setAllowed]=useState<boolean|null>(null);
 const[importBusy,setImportBusy]=useState(false),[importMessage,setImportMessage]=useState("");
 const[goalDiags,setGoalDiags]=useState<GoalDiag[]>([]),[positionDiag,setPositionDiag]=useState<PositionDiag|null>(null);
 const[checkBusy,setCheckBusy]=useState(false),[checkMessage,setCheckMessage]=useState(""),[checkRows,setCheckRows]=useState<CheckRow[]>([]);
 const[seasonBusy,setSeasonBusy]=useState(false),[seasonMessage,setSeasonMessage]=useState(""),[seasonDone,setSeasonDone]=useState(0),[seasonTotal,setSeasonTotal]=useState(0);
 const[seasonErrors,setSeasonErrors]=useState<ImportError[]>([]);

 useEffect(()=>{(async()=>{const supabase=getSupabaseBrowserClient();if(!supabase){setAllowed(false);return}const{data:s}=await supabase.auth.getSession();const user=s.session?.user;if(!user){setAllowed(false);return}const{data:p}=await supabase.from("players").select("admin").eq("id",user.id).maybeSingle();setAllowed(Boolean(p?.admin))})()},[]);
 async function token(forceRefresh=false){
  const supabase=getSupabaseBrowserClient();
  if(!supabase)throw new Error("Supabase er ikke tilgjengelig.");
  if(forceRefresh){const{data,error}=await supabase.auth.refreshSession();if(error||!data.session?.access_token)throw new Error("Kunne ikke fornye innloggingen.");return data.session.access_token}
  const{data}=await supabase.auth.getSession();const access=data.session?.access_token;if(!access)throw new Error("Du må være logget inn som admin.");return access
 }
 async function authedImport(matchId:number){
  const run=async(access:string)=>{const res=await fetch(`/api/fantasy-import?matchId=${matchId}&season=2025%2F26&tournamentId=435587`,{method:"POST",headers:{Authorization:`Bearer ${access}`}});let p:any={};try{p=await res.json()}catch{}return{res,p}};
  let access=await token();let{res,p}=await run(access);
  if(res.status===401){access=await token(true);({res,p}=await run(access));}
  if(!res.ok||!p.ok)throw new Error(p.error||`HTTP ${res.status}`);
  return p;
 }

 async function importMatch(){setImportBusy(true);setImportMessage("");setGoalDiags([]);setPositionDiag(null);try{const p=await authedImport(8183135);const r=p.result,e=r.enrichment;setGoalDiags(e?.goalDiagnostics||[]);if(e)setPositionDiag({teamMemberRows:e.teamMemberRows??0,tournamentPlayerRows:e.tournamentPlayerRows??0,teamMemberPositionValues:e.teamMemberPositionValues??[],tournamentPositionValues:e.tournamentPositionValues??[]});setImportMessage(`Importert ${r.game.home} ${r.game.homeScore}–${r.game.awayScore} ${r.game.away}: ${r.importedSkaters} utespillere + ${r.importedGoalies} keepere. Berikelse: ${e?.positionsUpdated??0} posisjoner, ${e?.plusMinusUpdated??0} +/−-rader. Mål: ${r.sourceRows?.goals??0} totalt · ${e?.plusMinusCountedGoals??0} tellende · ${e?.plusMinusSkippedSpecialTeamsGoals??0} special teams · ${e?.plusMinusUnresolvedGoals??0} uavklarte.`)}catch(e:any){setImportMessage(`Kunne ikke importere kamp: ${e?.message||"ukjent feil"}`)}finally{setImportBusy(false)}}

 async function loadCheck(){setCheckBusy(true);setCheckMessage("");try{let access=await token();let res=await fetch(`/api/fantasy-match-check?matchId=8183135`,{headers:{Authorization:`Bearer ${access}`}});if(res.status===401){access=await token(true);res=await fetch(`/api/fantasy-match-check?matchId=8183135`,{headers:{Authorization:`Bearer ${access}`}})}const p=await res.json();if(!res.ok||!p.ok)throw new Error(p.error||"Kontroll feilet");setCheckRows(p.result.rows||[]);setCheckMessage(`${p.result.game.home_team} ${p.result.game.home_score}–${p.result.game.away_score} ${p.result.game.away_team} · ${p.result.rows?.length||0} spillerrader · FP beregnet`)}catch(e:any){setCheckMessage(`Kunne ikke hente kontroll: ${e?.message||"ukjent feil"}`)}finally{setCheckBusy(false)}}

 async function importSeason(){
  setSeasonBusy(true);setSeasonMessage("Forbereder 2025/26 …");setSeasonDone(0);setSeasonTotal(0);setSeasonErrors([]);
  try{
   let access=await token();
   let prep=await fetch(`/api/fantasy-season-prepare?season=2025%2F26&tournamentId=435587`,{method:"POST",headers:{Authorization:`Bearer ${access}`}});
   if(prep.status===401){access=await token(true);prep=await fetch(`/api/fantasy-season-prepare?season=2025%2F26&tournamentId=435587`,{method:"POST",headers:{Authorization:`Bearer ${access}`}})}
   const pp=await prep.json();if(!prep.ok||!pp.ok)throw new Error(pp.error||"Kunne ikke forberede sesongen");
   const ids:number[]=pp.result.matchIds||[];setSeasonTotal(ids.length);setSeasonMessage(`Fant ${ids.length} historiske kamper. Importerer …`);
   let done=0;const errors:ImportError[]=[];const concurrency=2;
   for(let i=0;i<ids.length;i+=concurrency){
    const chunk=ids.slice(i,i+concurrency);
    const results=await Promise.all(chunk.map(async(matchId)=>{
      try{await authedImport(matchId);return{ok:true as const,matchId}}catch(e:any){return{ok:false as const,matchId,error:String(e?.message||e||"ukjent feil")}}
    }));
    for(const r of results){done++;if(!r.ok)errors.push({matchId:r.matchId,error:r.error})}
    setSeasonDone(done);setSeasonErrors([...errors]);setSeasonMessage(`Importerer 2025/26: ${done}/${ids.length} kamper · ${errors.length} feil`);
   }
   const success=done-errors.length;
   setSeasonMessage(`Ferdig! ${success} av ${done} kamper importert · ${errors.length} feilet.`);
  }catch(e:any){setSeasonMessage(`Sesongimport stoppet: ${e?.message||"ukjent feil"}`)}finally{setSeasonBusy(false)}
 }

 const groupedErrors=useMemo(()=>{const m=new Map<string,{count:number;ids:number[]}>();for(const e of seasonErrors){const key=e.error.replace(/\s+/g," ").trim();const v=m.get(key)||{count:0,ids:[]};v.count++;if(v.ids.length<8)v.ids.push(e.matchId);m.set(key,v)}return[...m.entries()].sort((a,b)=>b[1].count-a[1].count)},[seasonErrors]);

 if(allowed===null)return <main className="fantasy-shell"><p className="fantasy-lead">Sjekker admin-tilgang …</p></main>;
 if(!allowed)return <main className="fantasy-shell"><section className="fantasy-card"><p className="eyebrow">ADMIN ONLY</p><h1>Ingen tilgang</h1><p className="card-copy">Fantasy Hockey er bare tilgjengelig for administratorer.</p></section></main>;

 return <main className="fantasy-shell">
  <section className="fantasy-hero"><div><p className="fantasy-kicker">STANG INN · ADMIN · FANTASY HOCKEY</p><h1>Fantasy-sentralen</h1><p className="fantasy-lead">Automatisk spillerstatistikk, 19Fantasy-poeng, form, kampprogram og anbefalte bytter – uten regneark.</p></div><div className="fantasy-status"><span className="status-dot"/>Admin only</div></section>
  <section className="fantasy-metrics"><article><span>Lagverdi</span><strong>—</strong><small>Kobles til ditt fantasy-lag</small></article><article><span>Forventede poeng</span><strong>—</strong><small>Neste runde</small></article><article><span>Formspiller</span><strong>—</strong><small>Siste 5 kamper</small></article><article><span>Beste verdi</span><strong>—</strong><small>Poeng per million</small></article></section>
  <section className="fantasy-grid">
   <div className="fantasy-card fantasy-main-card"><div className="card-heading"><div><p className="eyebrow">RUNDEANALYSE</p><h2>Anbefalinger</h2></div><span className="pill">Neste runde</span></div><div className="recommendation-list">{recommendations.map(i=><div className="recommendation" key={i.label}><span className="recommendation-label">{i.label}</span><div><strong>{i.name}</strong><p>{i.detail}</p></div></div>)}</div></div>
   <div className="fantasy-card">
    <p className="eyebrow">DATASYNK</p><h2>Historisk grunnlag 2025/26</h2><p className="card-copy">Testkamp 8183135 brukes til detaljkontroll. Hele sesongen kan importeres som historisk grunnlag.</p>
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button onClick={importMatch} disabled={importBusy||seasonBusy}>{importBusy?"Importerer …":"Importer kamp 8183135"}</button><button onClick={loadCheck} disabled={checkBusy||seasonBusy}>{checkBusy?"Henter …":"Vis kontrolltabell + FP"}</button></div>
    {importMessage&&<p className="card-copy" style={{marginTop:10}}>{importMessage}</p>}
    {positionDiag&&<div style={{marginTop:14,background:"#eef3f8",borderRadius:12,padding:"10px 12px",color:"#26364c",fontSize:13}}><p className="eyebrow">POSISJONSDIAGNOSE</p><div><strong>Kampoppstilling:</strong> {positionDiag.teamMemberPositionValues.join(" · ")}</div><div><strong>Turnering:</strong> {positionDiag.tournamentPositionValues.join(" · ")}</div></div>}
    {goalDiags.length>0&&<div style={{marginTop:14,display:"grid",gap:8}}><p className="eyebrow">MÅLDIAGNOSE</p>{goalDiags.map(g=><div key={g.index} style={{background:"#eef3f8",borderRadius:12,padding:"10px 12px",fontSize:13,color:"#26364c"}}><strong>Mål {g.index}: {g.result}</strong><div>orgId: {g.scoringOrg||g.fields?.orgId||"—"} · lag: {g.scoringTeam||g.fields?.teamName||"—"}</div><div>home/away: {g.fields?.homeOrAwayTeam||"—"} · type: {g.fields?.goalType||"—"}</div></div>)}</div>}
    {checkMessage&&<p className="card-copy" style={{marginTop:10}}>{checkMessage}</p>}
    {checkRows.length>0&&<div style={{overflowX:"auto",marginTop:12,border:"1px solid #d7e0ea",borderRadius:12}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:820,color:"#102033",fontSize:13}}><thead><tr>{["Spiller","Lag","Pos","G","A","SOG","+/−","PIM","SV","GA","FP"].map(h=><th key={h} style={{textAlign:"left",padding:8,background:"#eef3f8"}}>{h}</th>)}</tr></thead><tbody>{checkRows.map((r,i)=><tr key={`${r.name}-${i}`}>{[r.name,r.team,r.position,r.goals,r.assists,r.shots,r.plusMinus>0?`+${r.plusMinus}`:r.plusMinus,r.pim,r.position==="G"?r.saves:"—",r.position==="G"?r.goalsAgainst:"—",Number.isInteger(r.fantasyPoints)?r.fantasyPoints:r.fantasyPoints.toFixed(1)].map((v,j)=><td key={j} style={{padding:8,borderBottom:"1px solid #e2e8f0",fontWeight:j===0||j===10?700:400,whiteSpace:j<2?"nowrap":"normal"}}>{v}</td>)}</tr>)}</tbody></table></div>}
    <div style={{marginTop:18,paddingTop:16,borderTop:"1px solid #d7e0ea"}}><p className="eyebrow">HELE SESONGEN</p><h3>Importer EHL 2025/26</h3><p className="card-copy">Importerer kampene i små puljer, fornyer innloggingen automatisk ved behov og viser faktisk feilårsak for kampene som ikke kan importeres.</p><button onClick={importSeason} disabled={seasonBusy||importBusy}>{seasonBusy?`Importerer ${seasonDone}/${seasonTotal||"…"}`:"Importer hele 2025/26"}</button>{seasonTotal>0&&<div style={{height:8,background:"#dbe5ee",borderRadius:999,overflow:"hidden",marginTop:10}}><div style={{height:"100%",width:`${Math.min(100,(seasonDone/seasonTotal)*100)}%`,background:"#2298ce"}}/></div>}{seasonMessage&&<p className="card-copy" style={{marginTop:8}}>{seasonMessage}</p>}
     {groupedErrors.length>0&&<div style={{marginTop:12,background:"#fff4f1",border:"1px solid #f0c6bb",borderRadius:12,padding:12,color:"#5e2b20",fontSize:13}}><p className="eyebrow" style={{marginBottom:8}}>FEILDIAGNOSE · {seasonErrors.length} KAMPER</p>{groupedErrors.map(([error,v])=><div key={error} style={{marginTop:8}}><strong>{v.count} ×</strong> {error}<div style={{opacity:.8}}>Eksempel-ID-er: {v.ids.join(", ")}</div></div>)}</div>}
    </div>
   </div>
   <div className="fantasy-card"><p className="eyebrow">KOMMENDE KAMPER</p><h2>Fixture rating</h2><div className="empty-state"><p>Terminlisten kobles til automatisk EHL-synk.</p></div></div>
   <div className="fantasy-card"><p className="eyebrow">BYTTEVERKTØY</p><h2>Optimaliser laget</h2><p className="card-copy">Velg budsjett og maks antall bytter. Motoren foreslår beste kombinasjon basert på forventede poeng og kampprogram.</p><button disabled>Kommer i neste steg</button></div>
  </section>
  <section className="fantasy-card build-status"><div><p className="eyebrow">STATUS</p><h2>Første MVP</h2></div><div className="status-steps"><span className="done">✓ Admin-låst</span><span className="done">✓ Datamodell</span><span className="done">✓ Kampdatakilde</span><span className="done">✓ Kampimport</span><span className="done">✓ Poengmotor</span><span>○ Anbefalingsmotor</span></div></section>
 </main>
}
