"use client";

import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "../../../../lib/supabase";
import "../../fantasy.css";

type Check={check_no:number;check_name:string;passed:boolean;detail:string};

export default function ScoringRulesE2EPage(){
 const[checks,setChecks]=useState<Check[]>([]),[msg,setMsg]=useState("Kjører skrivefri scoringtest …");
 useEffect(()=>{(async()=>{try{
  const sb=getSupabaseBrowserClient();if(!sb)throw new Error("Supabase er ikke tilgjengelig");
  const{data:s}=await sb.auth.getSession();const token=s.session?.access_token;if(!token)throw new Error("Du må være logget inn");
  const res=await fetch("/api/admin/fantasy/scoring-rules-e2e",{headers:{Authorization:`Bearer ${token}`}});const json=await res.json();
  if(!res.ok)throw new Error(json.error||`HTTP ${res.status}`);setChecks(json.checks||[]);setMsg(json.ok?"5/5 kontroller bestått":"En eller flere kontroller feilet");
 }catch(e:any){setMsg(e.message||String(e))}})()},[]);
 return <main className="fantasy-shell"><section className="team-builder-head"><div><p className="fantasy-kicker">FANTASY DIAGNOSE</p><h1>PP / SH / dropp E2E</h1><p>Skrivefri kontroll mot aktive Supabase-regler og den faktiske TypeScript-poengmotoren.</p></div></section><div className="team-panel"><h2>{msg}</h2><div style={{display:"grid",gap:10,marginTop:16}}>{checks.map(c=><div key={c.check_no} style={{padding:12,border:"1px solid #27394d",borderRadius:10,background:"#0d1825"}}><strong style={{color:c.passed?"#7ee2a8":"#ff9eaa"}}>{c.passed?"✓":"✗"} {c.check_no}. {c.check_name}</strong><p className="team-muted" style={{marginBottom:0}}>{c.detail}</p></div>)}</div></div></main>
}
