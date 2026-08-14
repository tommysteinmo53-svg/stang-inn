"use client";

import { useEffect,useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase";

type Standing={
 standings_position:number;
 team_id:string;
 user_id:string;
 team_name:string;
 total_points:number;
 rounds_scored:number;
 round_wins:number;
 best_round_points:number;
 average_round_points:number;
 last_round_no:number|null;
 last_round_points:number|null;
};

type HistoryRow={
 round_id:string;
 round_no:number;
 round_name:string|null;
 deadline_at:string;
 round_points:number;
 base_points:number;
 captain_bonus:number;
 vice_captain_bonus:number;
 round_position:number;
 calculated_at:string;
};

type Readiness={
 fantasy_teams:number;
 real_rounds:number;
 rounds_with_scores:number;
 stored_team_round_results:number;
 latest_scored_round:number|null;
};

type TestResult={
 check_name:string;
 expected_value:string;
 actual_value:string;
 passed:boolean;
};

export default function FantasyLeaderboard(){
 const season="2026/27";
 const[authenticated,setAuthenticated]=useState<boolean|null>(null);
 const[admin,setAdmin]=useState(false);
 const[rows,setRows]=useState<Standing[]>([]);
 const[selectedTeam,setSelectedTeam]=useState<string|null>(null);
 const[history,setHistory]=useState<Record<string,HistoryRow[]>>({});
 const[readiness,setReadiness]=useState<Readiness|null>(null);
 const[testResults,setTestResults]=useState<TestResult[]>([]);
 const[message,setMessage]=useState("");
 const[busy,setBusy]=useState(false);

 const n=(v:any)=>Number(v||0).toFixed(2).replace(".00","");
 const fmt=(v:string)=>new Intl.DateTimeFormat("nb-NO",{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/Oslo"}).format(new Date(v));

 useEffect(()=>{(async()=>{
  const sb=getSupabaseBrowserClient();
  if(!sb){setAuthenticated(false);return}
  const{data:s}=await sb.auth.getSession();
  const user=s.session?.user;
  if(!user){setAuthenticated(false);return}
  setAuthenticated(true);
  const{data:p}=await sb.from("players").select("admin").eq("id",user.id).maybeSingle();
  setAdmin(Boolean(p?.admin));
 })()},[]);

 async function load(){
  setBusy(true);setMessage("");
  try{
   const sb=getSupabaseBrowserClient();if(!sb)throw new Error("Supabase er ikke tilgjengelig");
   const{data,error}=await sb.rpc("get_fantasy_season_leaderboard",{p_season:season});
   if(error)throw error;
   setRows((data||[]) as Standing[]);
   if(admin){
    const{data:r,error:re}=await sb.rpc("get_fantasy_leaderboard_readiness",{p_season:season});
    if(!re){const rr=Array.isArray(r)?r[0]:r;setReadiness(rr||null)}
   }
  }catch(e:any){setMessage(`Kunne ikke hente tabellen: ${e?.message||"ukjent feil"}`)}finally{setBusy(false)}
 }

 useEffect(()=>{if(authenticated)load()},[authenticated,admin]);

 async function toggleHistory(teamId:string){
  if(selectedTeam===teamId){setSelectedTeam(null);return}
  setSelectedTeam(teamId);
  if(history[teamId])return;
  const sb=getSupabaseBrowserClient();if(!sb)return;
  const{data,error}=await sb.rpc("get_fantasy_team_season_history",{p_team_id:teamId,p_season:season});
  if(error){setMessage(`Kunne ikke hente rundehistorikk: ${error.message}`);return}
  setHistory(v=>({...v,[teamId]:(data||[]) as HistoryRow[]}));
 }

 async function setupTest(){
  setBusy(true);setTestResults([]);setMessage("Oppretter isolert leaderboard-test …");
  try{
   const sb=getSupabaseBrowserClient();if(!sb)throw new Error("Supabase er ikke tilgjengelig");
   const{data,error}=await sb.rpc("create_fantasy_leaderboard_e2e_test");
   if(error)throw error;
   const row=Array.isArray(data)?data[0]:data;
   setMessage(`Leaderboard-test opprettet i egen testsesong: ${row?.test_teams??0} lag · ${row?.test_rounds??0} runder · ${row?.test_results??0} lag/runde-resultater.`);
  }catch(e:any){setMessage(`Kunne ikke opprette leaderboard-test: ${e?.message||"ukjent feil"}`)}finally{setBusy(false)}
 }

 async function runTest(){
  setBusy(true);setMessage("Kontrollerer leaderboard …");
  try{
   const sb=getSupabaseBrowserClient();if(!sb)throw new Error("Supabase er ikke tilgjengelig");
   const{data,error}=await sb.rpc("run_fantasy_leaderboard_e2e_test");
   if(error)throw error;
   const result=(data||[]) as TestResult[];
   setTestResults(result);
   const passed=result.filter(r=>r.passed).length;
   setMessage(`Leaderboard-test: ${passed}/${result.length} kontroller bestått.`);
  }catch(e:any){setMessage(`Leaderboard-test feilet: ${e?.message||"ukjent feil"}`)}finally{setBusy(false)}
 }

 async function cleanupTest(){
  setBusy(true);
  try{
   const sb=getSupabaseBrowserClient();if(!sb)throw new Error("Supabase er ikke tilgjengelig");
   const{data,error}=await sb.rpc("cleanup_fantasy_leaderboard_e2e_test");
   if(error)throw error;
   setTestResults([]);
   setMessage(`Leaderboard-test ryddet bort · ${Number(data||0)} testlag/runder slettet. Ekte 2026/27-data er urørt.`);
   await load();
  }catch(e:any){setMessage(`Opprydding feilet: ${e?.message||"ukjent feil"}`)}finally{setBusy(false)}
 }

 if(authenticated===null)return <main style={{maxWidth:1050,margin:"40px auto",padding:20}}>Sjekker innlogging …</main>;
 if(!authenticated)return <main style={{maxWidth:1050,margin:"40px auto",padding:20}}><h1>Fantasy-tabell</h1><p>Du må være logget inn for å se fantasy-tabellen.</p></main>;

 return <main style={{maxWidth:1050,margin:"40px auto",padding:20,fontFamily:"system-ui"}}>
  <p style={{fontWeight:800,letterSpacing:1,fontSize:12}}>STANG INN · FANTASY HOCKEY</p>
  <div style={{display:"flex",justifyContent:"space-between",gap:16,alignItems:"end",flexWrap:"wrap"}}>
   <div><h1 style={{marginBottom:6}}>Tabell 2026/27</h1><p style={{marginTop:0}}>Totalpoeng summeres fra de lagrede rundepoengene. Trykk på et lag for rundehistorikk.</p></div>
   <button onClick={load} disabled={busy} style={{padding:"10px 14px"}}>{busy?"Oppdaterer …":"Oppdater tabell"}</button>
  </div>

  {admin&&<section style={{padding:14,background:"#fff",color:"#000",border:"1px solid #d1d5db",borderRadius:10,margin:"16px 0"}}>
   {readiness&&<div><b>Admin-kontroll:</b> {readiness.fantasy_teams} lag · {readiness.rounds_with_scores}/{readiness.real_rounds} runder med poeng · {readiness.stored_team_round_results} lag/runde-resultater{readiness.latest_scored_round?` · sist beregnet runde ${readiness.latest_scored_round}`:" · ingen runder beregnet ennå"}.</div>}
   <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid #e5e7eb"}}>
    <b>Leaderboard E2E-test</b>
    <p style={{margin:"6px 0 10px"}}>Isolert testsesong med 4 lag og 3 runder. Verifiserer delt plassering, rundeseire, snitt, beste/siste runde og rundehistorikk.</p>
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
     <button onClick={setupTest} disabled={busy} style={{padding:"8px 12px"}}>1. Opprett test</button>
     <button onClick={runTest} disabled={busy} style={{padding:"8px 12px"}}>2. Kjør og kontroller</button>
     <button onClick={cleanupTest} disabled={busy} style={{padding:"8px 12px"}}>3. Rydd test</button>
    </div>
    {testResults.length>0&&<div style={{display:"grid",gap:7,marginTop:12}}>{testResults.map(r=><div key={r.check_name} style={{padding:9,border:"1px solid #d1d5db",borderRadius:8,background:"#f8fafc"}}><b>{r.passed?"✅":"❌"} {r.check_name}</b><div style={{fontSize:13,marginTop:3}}>Forventet: {r.expected_value}</div><div style={{fontSize:13}}>Faktisk: {r.actual_value}</div></div>)}</div>}
   </div>
  </section>}

  {message&&<div style={{padding:12,background:"#fff",color:"#000",border:"1px solid #e5e7eb",borderRadius:10,marginBottom:14}}>{message}</div>}

  {rows.length===0?<div style={{padding:18,border:"1px solid #d1d5db",borderRadius:12}}><b>Ingen fantasy-lag ennå.</b></div>:
  <div style={{display:"grid",gap:10}}>{rows.map(r=><div key={r.team_id} style={{border:"1px solid #d1d5db",borderRadius:12,overflow:"hidden"}}>
   <button onClick={()=>toggleHistory(r.team_id)} style={{width:"100%",border:0,padding:14,cursor:"pointer",textAlign:"left",display:"grid",gridTemplateColumns:"64px minmax(160px,1fr) repeat(5,minmax(70px,auto))",gap:12,alignItems:"center"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"flex-start",gap:7,minWidth:0}}>
     <span style={{width:22,textAlign:"center",fontSize:18,lineHeight:1}}>{r.rounds_scored>0&&r.standings_position===1?"🏆":""}</span>
     <strong style={{fontSize:20,whiteSpace:"nowrap"}}>{r.standings_position}.</strong>
    </div>
    <div><b>{selectedTeam===r.team_id?"▾":"▸"} {r.team_name}</b><div style={{fontSize:12,opacity:.7}}>{r.rounds_scored} runder</div></div>
    <span style={{textAlign:"right"}}>Totalt<br/><b>{n(r.total_points)}</b></span>
    <span style={{textAlign:"right"}}>Rundeseire<br/><b>{r.round_wins}</b></span>
    <span style={{textAlign:"right"}}>Snitt<br/><b>{n(r.average_round_points)}</b></span>
    <span style={{textAlign:"right"}}>Beste<br/><b>{n(r.best_round_points)}</b></span>
    <span style={{textAlign:"right"}}>Siste<br/><b>{r.last_round_no?`R${r.last_round_no}: ${n(r.last_round_points)}`:"—"}</b></span>
   </button>

   {selectedTeam===r.team_id&&<div style={{padding:"0 14px 14px",overflowX:"auto"}}>
    {(history[r.team_id]||[]).length===0?<p style={{marginBottom:0}}>Ingen beregnede runder for dette laget ennå.</p>:
    <table style={{width:"100%",borderCollapse:"collapse",fontSize:14}}><thead><tr><th style={{textAlign:"left",padding:8}}>Runde</th><th>Plass</th><th>Base</th><th>C-bonus</th><th>VC-bonus</th><th>Poeng</th><th style={{textAlign:"right"}}>Deadline</th></tr></thead><tbody>
     {(history[r.team_id]||[]).map(h=><tr key={h.round_id} style={{borderTop:"1px solid #e5e7eb"}}><td style={{padding:8}}><b>Runde {h.round_no}</b></td><td style={{textAlign:"center"}}>{h.round_position===1?"🏆 ":""}{h.round_position}.</td><td style={{textAlign:"right"}}>{n(h.base_points)}</td><td style={{textAlign:"right"}}>{n(h.captain_bonus)}</td><td style={{textAlign:"right"}}>{n(h.vice_captain_bonus)}</td><td style={{textAlign:"right"}}><b>{n(h.round_points)}</b></td><td style={{textAlign:"right"}}>{fmt(h.deadline_at)}</td></tr>)}
    </tbody></table>}
   </div>}
  </div>)}</div>}
 </main>;
}
