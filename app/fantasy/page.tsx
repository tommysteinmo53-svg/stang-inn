"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase";
import "./fantasy.css";

type Recommendation = { label: string; name: string; detail: string };
type CheckRow = { name:string;team:string;position:string;goals:number;assists:number;shots:number;plusMinus:number;pim:number;saves:number;goalsAgainst:number;win:boolean|null;shutout:boolean|null;didPlay:boolean;fantasyPoints:number };
type GoalDiag = { index:number;result:string;scoringTeam?:string;scoringOrg?:string;homeIds?:number;awayIds?:number;fields?:Record<string,string> };
type PositionDiag = { teamMemberRows:number;tournamentPlayerRows:number;teamMemberPositionValues:string[];tournamentPositionValues:string[] };

const recommendations:Recommendation[]=[
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

 useEffect(()=>{(async()=>{const supabase=getSupabaseBrowserClient();if(!supabase){setAllowed(false);return}const{data:sessionData}=await supabase.auth.getSession();const user=sessionData.session?.user;if(!user){setAllowed(false);return}const{data:player}=await supabase.from("players").select("admin").eq("id",user.id).maybeSingle();setAllowed(Boolean(player?.admin))})()},[]);
 async function token(){const supabase=getSupabaseBrowserClient();const{data}=(await supabase?.auth.getSession())??{data:{session:null}};const access=data.session?.access_token;if(!access)throw new Error("Du må være logget inn som admin.");return access}

 async function importMatch(){setImportBusy(true);setImportMessage("");setGoalDiags([]);setPositionDiag(null);setCheckRows([]);setCheckMessage("");try{const access=await token();const response=await fetch(`/api/fantasy-import?matchId=8183135&season=2025%2F26&tournamentId=435587`,{method:"POST",headers:{Authorization:`Bearer ${access}`}});const payload=await response.json();if(!response.ok||!payload.ok)throw new Error(payload.error||"Import feilet");const r=payload.result,e=r.enrichment,goalsTotal=r.sourceRows?.goals??0;setGoalDiags(e?.goalDiagnostics||[]);if(e)setPositionDiag({teamMemberRows:e.teamMemberRows??0,tournamentPlayerRows:e.tournamentPlayerRows??0,teamMemberPositionValues:e.teamMemberPositionValues??[],tournamentPositionValues:e.tournamentPositionValues??[]});setImportMessage(`Importert ${r.game.home} ${r.game.homeScore}–${r.game.awayScore} ${r.game.away}: ${r.importedSkaters} utespillere + ${r.importedGoalies} keepere.${e?` Berikelse: ${e.positionsUpdated} posisjoner, ${e.plusMinusUpdated} +/−-rader. Mål: ${goalsTotal} totalt · ${e.plusMinusCountedGoals} tellende · ${e.plusMinusSkippedSpecialTeamsGoals??0} special teams · ${e.plusMinusUnresolvedGoals??0} uavklarte.`:""}`)}catch(error:any){setImportMessage(`Kunne ikke importere kamp: ${error?.message||"ukjent feil"}`)}finally{setImportBusy(false)}}

 async function loadCheck(){setCheckBusy(true);setCheckMessage("");try{const access=await token();const response=await fetch(`/api/fantasy-match-check?matchId=8183135`,{headers:{Authorization:`Bearer ${access}`}});const payload=await response.json();if(!response.ok||!payload.ok)throw new Error(payload.error||"Kontroll feilet");setCheckRows(payload.result.rows||[]);setCheckMessage(`${payload.result.game.home_team} ${payload.result.game.home_score}–${payload.result.game.away_score} ${payload.result.game.away_team} · ${payload.result.rows?.length||0} spillerrader · FP beregnet`)}catch(error:any){setCheckMessage(`Kunne ikke hente kontroll: ${error?.message||"ukjent feil"}`)}finally{setCheckBusy(false)}}

 async function importSeason(){
  setSeasonBusy(true);setSeasonMessage("Forbereder 2025/26 …");setSeasonDone(0);setSeasonTotal(0);
  try{
   const access=await token();
   const prep=await fetch(`/api/fantasy-season-prepare?season=2025%2F26&tournamentId=435587`,{method:"POST",headers:{Authorization:`Bearer ${access}`}});
   const prepPayload=await prep.json();if(!prep.ok||!prepPayload.ok)throw new Error(prepPayload.error||"Kunne ikke forberede sesongen");
   const ids:number[]=prepPayload.result.matchIds||[];setSeasonTotal(ids.length);
   let done=0,failed=0;const failedIds:number[]=[];
   setSeasonMessage(`Fant ${ids.length} ferdige kamper. Importerer …`);
   const concurrency=2;
   for(let i=0;i<ids.length;i+=concurrency){
    const chunk=ids.slice(i,i+concurrency);
    const results=await Promise.all(chunk.map(async(matchId)=>{
      try{const response=await fetch(`/api/fantasy-import?matchId=${matchId}&season=2025%2F26&tournamentId=435587`,{method:"POST",headers:{Authorization:`Bearer ${access}`}});const payload=await response.json();if(!response.ok||!payload.ok)throw new Error(payload.error||"Importfeil");return{ok:true,matchId}}catch{return{ok:false,matchId}}
    }));
    for(const result of results){done+=1;if(!result.ok){failed+=1;failedIds.push(result.matchId)}}
    setSeasonDone(done);setSeasonMessage(`Importerer 2025/26: ${done}/${ids.length} kamper · ${failed} feil`);
   }
   setSeasonMessage(failed===0?`Ferdig! ${done} kamper fra 2025/26 er importert.`:`Ferdig med ${done} kamper. ${failed} feilet${failedIds.length?` (${failedIds.slice(0,8).join(", ")}${failedIds.length>8?" …":""})`:""}. Du kan kjøre importen igjen; eksisterende data overskrives trygt.`);
  }catch(error:any){setSeasonMessage(`Sesongimport stoppet: ${error?.message||"ukjent feil"}`)}finally{setSeasonBusy(false)}
 }

 if(allowed===null)return <main className="fantasy-shell"><p className="fantasy-lead">Sjekker admin-tilgang …</p></main>;
 if(!allowed)return <main className="fantasy-shell"><section className="fantasy-card"><p className="eyebrow">ADMIN ONLY</p><h1>Ingen tilgang</h1><p className="card-copy">Fantasy Hockey er bare tilgjengelig for administratorer.</p><a href="/" className="pill" style={{textDecoration:"none",display:"inline-block",marginTop:12}}>← Tilbake til Stang Inn</a></section></main>;

 return <main className="fantasy-shell">
  <section className="fantasy-hero"><div><p className="fantasy-kicker">STANG INN · ADMIN · FANTASY HOCKEY</p><h1>Fantasy-sentralen</h1><p className="fantasy-lead">Automatisk spillerstatistikk, 19Fantasy-poeng, form, kampprogram og anbefalte bytter – uten regneark.</p></div><div className="fantasy-status"><span className="status-dot"/>Admin only</div></section>
  <section className="fantasy-metrics"><article><span>Lagverdi</span><strong>—</strong><small>Kobles til ditt fantasy-lag</small></article><article><span>Forventede poeng</span><strong>—</strong><small>Neste runde</small></article><article><span>Formspiller</span><strong>—</strong><small>Siste 5 kamper</small></article><article><span>Beste verdi</span><strong>—</strong><small>Poeng per million</small></article></section>
  <section className="fantasy-grid">
   <div className="fantasy-card fantasy-main-card"><div className="card-heading"><div><p className="eyebrow">RUNDEANALYSE</p><h2>Anbefalinger</h2></div><span className="pill">Neste runde</span></div><div className="recommendation-list">{recommendations.map(item=><div className="recommendation" key={item.label}><span className="recommendation-label">{item.label}</span><div><strong>{item.name}</strong><p>{item.detail}</p></div></div>)}</div></div>
   <div className="fantasy-card">
    <p className="eyebrow">DATASYNK</p><h2>Historisk grunnlag 2025/26</h2><p className="card-copy">Testkamp 8183135 brukes til detaljkontroll. Når den er godkjent kan hele den ferdigspilte 2025/26-sesongen importeres som historisk grunnlag.</p>
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button type="button" onClick={importMatch} disabled={importBusy||seasonBusy}>{importBusy?"Importerer …":"Importer kamp 8183135"}</button><button type="button" onClick={loadCheck} disabled={checkBusy||seasonBusy}>{checkBusy?"Henter kontroll …":"Vis kontrolltabell + FP"}</button></div>
    {importMessage?<p className="card-copy" style={{marginTop:10}}>{importMessage}</p>:null}
    {positionDiag?<div style={{marginTop:14,background:"#eef3f8",borderRadius:12,padding:"10px 12px",color:"#26364c",fontSize:13,lineHeight:1.5}}><p className="eyebrow" style={{marginBottom:6}}>POSISJONSDIAGNOSE</p><div><strong>Kampoppstilling ({positionDiag.teamMemberRows} rader):</strong> {positionDiag.teamMemberPositionValues.join(" · ")||"ingen posisjonsverdier"}</div><div style={{marginTop:4}}><strong>Turnering ({positionDiag.tournamentPlayerRows} rader):</strong> {positionDiag.tournamentPositionValues.join(" · ")||"ingen posisjonsverdier"}</div></div>:null}
    {goalDiags.length?<div style={{marginTop:14,display:"grid",gap:8}}><p className="eyebrow" style={{marginBottom:0}}>MÅLDIAGNOSE</p>{goalDiags.map(g=><div key={g.index} style={{background:"#eef3f8",borderRadius:12,padding:"10px 12px",fontSize:13,lineHeight:1.45,color:"#26364c"}}><strong>Mål {g.index}: {g.result}</strong><div>orgId: {g.scoringOrg||g.fields?.orgId||"—"} · lag: {g.scoringTeam||g.fields?.teamName||g.fields?.teamShortName||"—"}</div><div>home/away: {g.fields?.homeOrAwayTeam||"—"} · type: {g.fields?.goalType||"—"}</div><div>på isen: hjemme {g.homeIds??"—"} · borte {g.awayIds??"—"}</div></div>)}</div>:null}
    {checkMessage?<p className="card-copy" style={{marginTop:10}}>{checkMessage}</p>:null}
    {checkRows.length?<div style={{overflowX:"auto",marginTop:12,border:"1px solid #d7e0ea",borderRadius:12}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:820,color:"#102033",fontSize:13}}><thead><tr>{["Spiller","Lag","Pos","G","A","SOG","+/−","PIM","SV","GA","FP"].map(h=><th key={h} style={{textAlign:"left",padding:"9px 8px",borderBottom:"1px solid #cbd5e1",whiteSpace:"nowrap",background:"#eef3f8"}}>{h}</th>)}</tr></thead><tbody>{checkRows.map((r,i)=><tr key={`${r.name}-${i}`}><td style={{padding:8,borderBottom:"1px solid #e2e8f0",fontWeight:700,whiteSpace:"nowrap"}}>{r.name}</td><td style={{padding:8,borderBottom:"1px solid #e2e8f0",whiteSpace:"nowrap"}}>{r.team}</td><td style={{padding:8,borderBottom:"1px solid #e2e8f0"}}>{r.position}</td><td style={{padding:8,borderBottom:"1px solid #e2e8f0"}}>{r.goals}</td><td style={{padding:8,borderBottom:"1px solid #e2e8f0"}}>{r.assists}</td><td style={{padding:8,borderBottom:"1px solid #e2e8f0"}}>{r.shots}</td><td style={{padding:8,borderBottom:"1px solid #e2e8f0",fontWeight:700}}>{r.plusMinus>0?`+${r.plusMinus}`:r.plusMinus}</td><td style={{padding:8,borderBottom:"1px solid #e2e8f0"}}>{r.pim}</td><td style={{padding:8,borderBottom:"1px solid #e2e8f0"}}>{r.position==="G"?r.saves:"—"}</td><td style={{padding:8,borderBottom:"1px solid #e2e8f0"}}>{r.position==="G"?r.goalsAgainst:"—"}</td><td style={{padding:8,borderBottom:"1px solid #e2e8f0",fontWeight:800}}>{Number.isInteger(r.fantasyPoints)?r.fantasyPoints:r.fantasyPoints.toFixed(1)}</td></tr>)}</tbody></table></div>:null}
    <div style={{marginTop:18,paddingTop:16,borderTop:"1px solid #d7e0ea"}}><p className="eyebrow">HELE SESONGEN</p><h3 style={{margin:"4px 0 8px"}}>Importer EHL 2025/26</h3><p className="card-copy">Importerer ferdigspilte kamper i små puljer. La denne siden stå åpen mens importen kjører. Du kan kjøre den på nytt uten duplikater.</p><button type="button" onClick={importSeason} disabled={seasonBusy||importBusy}>{seasonBusy?`Importerer ${seasonDone}/${seasonTotal||"…"}`:"Importer hele 2025/26"}</button>{seasonTotal>0?<div style={{height:8,background:"#dbe5ee",borderRadius:999,overflow:"hidden",marginTop:10}}><div style={{height:"100%",width:`${Math.min(100,(seasonDone/seasonTotal)*100)}%`,background:"#2298ce",transition:"width .2s"}}/></div>:null}{seasonMessage?<p className="card-copy" style={{marginTop:8}}>{seasonMessage}</p>:null}</div>
   </div>
   <div className="fantasy-card"><p className="eyebrow">KOMMENDE KAMPER</p><h2>Fixture rating</h2><div className="empty-state"><p>Terminlisten kobles til automatisk EHL-synk.</p></div></div>
   <div className="fantasy-card"><p className="eyebrow">BYTTEVERKTØY</p><h2>Optimaliser laget</h2><p className="card-copy">Velg budsjett og maks antall bytter. Motoren foreslår beste kombinasjon basert på forventede poeng og kampprogram.</p><button type="button" disabled>Kommer i neste steg</button></div>
  </section>
  <section className="fantasy-card build-status"><div><p className="eyebrow">STATUS</p><h2>Første MVP</h2></div><div className="status-steps"><span className="done">✓ Admin-låst</span><span className="done">✓ Datamodell</span><span className="done">✓ Kampdatakilde</span><span className="done">✓ Kampimport</span><span className="done">✓ Poengmotor test</span><span>○ Historisk sesong</span><span>○ Anbefalingsmotor</span></div></section>
 </main>;
}
