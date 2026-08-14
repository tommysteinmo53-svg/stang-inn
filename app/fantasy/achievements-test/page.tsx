"use client";

import { useEffect,useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase";

type TestResult={
 check_name:string;
 expected_value:string;
 actual_value:string;
 passed:boolean;
};

export default function FantasyAchievementsTest(){
 const[authenticated,setAuthenticated]=useState<boolean|null>(null);
 const[admin,setAdmin]=useState(false);
 const[busy,setBusy]=useState(false);
 const[message,setMessage]=useState("");
 const[results,setResults]=useState<TestResult[]>([]);

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

 async function setup(){
  setBusy(true);setResults([]);setMessage("Oppretter isolert achievements-test …");
  try{
   const sb=getSupabaseBrowserClient();if(!sb)throw new Error("Supabase er ikke tilgjengelig");
   const{data,error}=await sb.rpc("create_fantasy_achievements_e2e_test");
   if(error)throw error;
   const row=Array.isArray(data)?data[0]:data;
   setMessage(`Achievements-test opprettet: ${row?.test_teams??0} lag · ${row?.test_rounds??0} runder · ${row?.test_results??0} lag/runde-resultater.`);
  }catch(e:any){setMessage(`Kunne ikke opprette achievements-test: ${e?.message||"ukjent feil"}`)}finally{setBusy(false)}
 }

 async function run(){
  setBusy(true);setMessage("Kontrollerer månedsvinner, streak og eksperttitler …");
  try{
   const sb=getSupabaseBrowserClient();if(!sb)throw new Error("Supabase er ikke tilgjengelig");
   const{data,error}=await sb.rpc("run_fantasy_achievements_e2e_test");
   if(error)throw error;
   const rows=(data||[]) as TestResult[];
   setResults(rows);
   const passed=rows.filter(r=>r.passed).length;
   setMessage(`Achievements-test: ${passed}/${rows.length} kontroller bestått.`);
  }catch(e:any){setMessage(`Achievements-test feilet: ${e?.message||"ukjent feil"}`)}finally{setBusy(false)}
 }

 async function cleanup(){
  setBusy(true);
  try{
   const sb=getSupabaseBrowserClient();if(!sb)throw new Error("Supabase er ikke tilgjengelig");
   const{data,error}=await sb.rpc("cleanup_fantasy_achievements_e2e_test");
   if(error)throw error;
   setResults([]);
   setMessage(`Achievements-test ryddet bort · ${Number(data||0)} testlag/runder slettet. Ekte 2026/27-data er urørt.`);
  }catch(e:any){setMessage(`Opprydding feilet: ${e?.message||"ukjent feil"}`)}finally{setBusy(false)}
 }

 if(authenticated===null)return <main style={{maxWidth:900,margin:"40px auto",padding:20}}>Sjekker innlogging …</main>;
 if(!authenticated)return <main style={{maxWidth:900,margin:"40px auto",padding:20}}><h1>Achievements-test</h1><p>Du må være logget inn.</p></main>;
 if(!admin)return <main style={{maxWidth:900,margin:"40px auto",padding:20}}><h1>Achievements-test</h1><p>Kun administrator kan kjøre denne testen.</p></main>;

 return <main style={{maxWidth:900,margin:"40px auto",padding:20,fontFamily:"system-ui"}}>
  <p style={{fontWeight:800,letterSpacing:1,fontSize:12}}>STANG INN · FANTASY HOCKEY · ADMIN</p>
  <h1 style={{marginBottom:6}}>Achievements E2E-test</h1>
  <p style={{marginTop:0}}>Isolert testsesong med 20 lag og 4 runder. Verifiserer månedsvinnere, brutt og aktiv streak, alle konkurransetittel-nivåene og samlet achievement-visning.</p>

  <section style={{padding:14,background:"#fff",color:"#000",border:"1px solid #d1d5db",borderRadius:10,margin:"18px 0"}}>
   <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
    <button onClick={setup} disabled={busy} style={{padding:"9px 13px"}}>1. Opprett test</button>
    <button onClick={run} disabled={busy} style={{padding:"9px 13px"}}>2. Kjør og kontroller</button>
    <button onClick={cleanup} disabled={busy} style={{padding:"9px 13px"}}>3. Rydd test</button>
   </div>
  </section>

  {message&&<div style={{padding:12,background:"#fff",color:"#000",border:"1px solid #e5e7eb",borderRadius:10,marginBottom:14}}>{message}</div>}

  {results.length>0&&<div style={{display:"grid",gap:9}}>{results.map(r=><div key={r.check_name} style={{padding:12,border:"1px solid #d1d5db",borderRadius:10,background:"#fff",color:"#000"}}>
   <b>{r.passed?"✅":"❌"} {r.check_name}</b>
   <div style={{fontSize:13,marginTop:4}}>Forventet: {r.expected_value}</div>
   <div style={{fontSize:13}}>Faktisk: {r.actual_value}</div>
  </div>)}</div>}
 </main>;
}
