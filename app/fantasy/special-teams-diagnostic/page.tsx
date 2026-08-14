"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase";

export default function SpecialTeamsDiagnosticPage(){
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [result,setResult]=useState<any>(null);

  async function run(){
    setBusy(true); setError(""); setResult(null);
    try{
      const sb=getSupabaseBrowserClient();
      if(!sb) throw new Error("Supabase er ikke tilgjengelig");
      const {data}=await sb.auth.getSession();
      const token=data.session?.access_token;
      if(!token) throw new Error("Du må være logget inn som admin");
      const res=await fetch("/api/fantasy-import?matchId=8183135&season=2025%2F26&tournamentId=435587",{
        method:"POST",headers:{Authorization:`Bearer ${token}`}
      });
      const payload=await res.json();
      if(!res.ok||!payload.ok) throw new Error(payload.error||`HTTP ${res.status}`);
      const e=payload.result?.enrichment||{};
      setResult({
        specialTeams:e.specialTeams||null,
        specialStatCoverage:e.specialStatCoverage||null,
        totalGoals:e.totalGoals,
        goalDiagnostics:e.goalDiagnostics||[],
      });
    }catch(e:any){setError(e?.message||"Ukjent feil")}finally{setBusy(false)}
  }

  const samples=result?.specialStatCoverage?.samples||[];

  return <main style={{maxWidth:1100,margin:"40px auto",padding:20,fontFamily:"system-ui"}}>
    <h1>Special teams- og faceoff-diagnostikk</h1>
    <p>Kjører testkamp 8183135 og viser rå målfelt for PP/SH samt HockeyLive-feltene for faceoffs.</p>
    <button onClick={run} disabled={busy} style={{padding:"10px 16px"}}>{busy?"Kjører …":"Kjør diagnostikk"}</button>
    {error&&<p style={{color:"#b91c1c"}}>{error}</p>}
    {result&&<>
      <h2>Oppsummering</h2>
      <pre style={{whiteSpace:"pre-wrap",background:"#f8fafc",padding:16,borderRadius:10}}>{JSON.stringify({specialTeams:result.specialTeams,specialStatCoverage:result.specialStatCoverage,totalGoals:result.totalGoals},null,2)}</pre>
      <h2>Faceoff-eksempler</h2>
      {samples.length===0?<p>Ingen spillere med registrerte faceoffs i denne feeden.</p>:<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:14}}><thead><tr><th style={{textAlign:"left",padding:8}}>Person-ID</th><th style={{textAlign:"right",padding:8}}>faceOffs</th><th style={{textAlign:"right",padding:8}}>Win %</th><th style={{textAlign:"right",padding:8}}>Beregnet vunnet</th><th style={{textAlign:"right",padding:8}}>Tatt</th></tr></thead><tbody>{samples.map((s:any,i:number)=><tr key={`${s.personId}-${i}`} style={{borderTop:"1px solid #e2e8f0"}}><td style={{padding:8}}>{s.personId||"—"}</td><td style={{padding:8,textAlign:"right"}}>{s.faceOffs??"—"}</td><td style={{padding:8,textAlign:"right"}}>{s.winPct??"—"}</td><td style={{padding:8,textAlign:"right"}}><b>{s.derivedWon??0}</b></td><td style={{padding:8,textAlign:"right"}}><b>{s.taken??0}</b></td></tr>)}</tbody></table></div>}
      <h2>Målhendelser</h2>
      <pre style={{whiteSpace:"pre-wrap",background:"#f8fafc",padding:16,borderRadius:10,maxHeight:700,overflow:"auto"}}>{JSON.stringify(result.goalDiagnostics,null,2)}</pre>
    </>}
  </main>
}
