"use client";

import { useEffect,useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase";

type RoundRow={round_id:string;round_no:number;round_name:string|null;deadline_at:string;status:string;game_count:number;snapshot_count:number};
type TeamScore={team_round_points_id:string;snapshot_id:string;team_id:string;user_id:string;team_name:string;base_points:number;captain_bonus:number;vice_captain_bonus:number;total_points:number;player_rows:number;calculated_at:string};
type PlayerBreakdown={player_id:string;player_name:string;position:string;team:string;is_captain:boolean;is_vice_captain:boolean;played:boolean;games_played:number;raw_points:number;multiplier:number;bonus_points:number;total_points:number};

export default function FantasyScoringAdmin(){
 const season="2026/27";
 const[allowed,setAllowed]=useState<boolean|null>(null);
 const[rounds,setRounds]=useState<RoundRow[]>([]);
 const[selectedRound,setSelectedRound]=useState<string>("");
 const[scores,setScores]=useState<TeamScore[]>([]);
 const[breakdowns,setBreakdowns]=useState<Record<string,PlayerBreakdown[]>>({});
 const[openScore,setOpenScore]=useState<string|null>(null);
 const[busy,setBusy]=useState(false);
 const[message,setMessage]=useState("");

 const fmt=(v:string|null|undefined)=>v?new Intl.DateTimeFormat("nb-NO",{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/Oslo"}).format(new Date(v)):"—";
 const n=(v:any)=>Number(v||0).toFixed(2).replace(".00","");

 useEffect(()=>{(async()=>{const sb=getSupabaseBrowserClient();if(!sb){setAllowed(false);return}const{data:s}=await sb.auth.getSession();const user=s.session?.user;if(!user){setAllowed(false);return}const{data:p}=await sb.from("players").select("admin").eq("id",user.id).maybeSingle();setAllowed(Boolean(p?.admin))})()},[]);

 async function loadRounds(){
  const sb=getSupabaseBrowserClient();if(!sb)return;
  const{data,error}=await sb.rpc("get_fantasy_round_admin_overview",{p_season:season});
  if(error){setMessage(`Kunne ikke hente runder: ${error.message}`);return}
  const rows=(data||[]) as RoundRow[];setRounds(rows);
  if(!selectedRound&&rows.length)setSelectedRound(rows[0].round_id);
 }
 useEffect(()=>{if(allowed)loadRounds()},[allowed]);
 useEffect(()=>{if(selectedRound)loadScores(selectedRound)},[selectedRound]);

 async function loadScores(roundId:string){
  const sb=getSupabaseBrowserClient();if(!sb)return;
  const{data,error}=await sb.rpc("get_fantasy_round_team_points_admin",{p_round_id:roundId});
  if(error){setMessage(`Kunne ikke hente rundepoeng: ${error.message}`);return}
  setScores((data||[]) as TeamScore[]);setBreakdowns({});setOpenScore(null);
 }

 async function calculate(){
  if(!selectedRound)return;
  setBusy(true);setMessage("Beregner rundepoeng …");
  try{
   const sb=getSupabaseBrowserClient();if(!sb)throw new Error("Supabase er ikke tilgjengelig");
   const{data,error}=await sb.rpc("calculate_fantasy_round_team_points",{p_round_id:selectedRound});
   if(error)throw error;
   const row=Array.isArray(data)?data[0]:data;
   await loadScores(selectedRound);
   setMessage(`Beregnet: ${row?.snapshots_scored??0} snapshots · ${row?.player_rows??0} spillerrader · ${n(row?.total_points)} FP totalt.`);
  }catch(e:any){setMessage(`Poengberegning feilet: ${e?.message||"ukjent feil"}`)}finally{setBusy(false)}
 }

 async function toggleBreakdown(score:TeamScore){
  if(openScore===score.team_round_points_id){setOpenScore(null);return}
  setOpenScore(score.team_round_points_id);
  if(breakdowns[score.team_round_points_id])return;
  const sb=getSupabaseBrowserClient();if(!sb)return;
  const{data,error}=await sb.rpc("get_fantasy_team_round_player_breakdown_admin",{p_team_round_points_id:score.team_round_points_id});
  if(error){setMessage(`Kunne ikke hente breakdown: ${error.message}`);return}
  setBreakdowns(v=>({...v,[score.team_round_points_id]:(data||[]) as PlayerBreakdown[]}));
 }

 if(allowed===null)return <main style={{maxWidth:1100,margin:"40px auto",padding:20}}>Sjekker admin-tilgang …</main>;
 if(!allowed)return <main style={{maxWidth:1100,margin:"40px auto",padding:20}}><h1>Ingen tilgang</h1></main>;
 const current=rounds.find(r=>r.round_id===selectedRound);

 return <main style={{maxWidth:1100,margin:"40px auto",padding:20,fontFamily:"system-ui"}}>
  <p style={{fontWeight:700,letterSpacing:1,fontSize:12}}>STANG INN · ADMIN</p>
  <h1>Fantasy-poeng 2026/27</h1>
  <p>Rundepoeng beregnes fra det låste snapshotet. Kaptein får sesongens kapteinsmultiplikator dersom han har registrert kampstatistikk i runden. Hvis kapteinen ikke spiller, overtar visekapteinen multiplikatoren.</p>
  <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap",margin:"20px 0"}}>
   <select value={selectedRound} onChange={e=>setSelectedRound(e.target.value)} style={{padding:"10px 12px"}}>
    {rounds.map(r=><option key={r.round_id} value={r.round_id}>Fantasy-runde {r.round_no} · {r.snapshot_count} snapshots</option>)}
   </select>
   <button onClick={calculate} disabled={busy||!selectedRound} style={{padding:"10px 16px"}}>{busy?"Beregner …":"Beregn / beregn på nytt"}</button>
   <button onClick={()=>selectedRound&&loadScores(selectedRound)} disabled={busy} style={{padding:"10px 16px"}}>Oppdater</button>
  </div>
  {current&&<div style={{padding:12,background:"#fff",color:"#000",border:"1px solid #d1d5db",borderRadius:10,marginBottom:12}}><b>Fantasy-runde {current.round_no}</b> · deadline {fmt(current.deadline_at)} · {current.game_count} kamper · {current.snapshot_count} snapshots · status {current.status}</div>}
  {message&&<div style={{padding:12,background:"#fff",color:"#000",border:"1px solid #e5e7eb",borderRadius:10,marginBottom:16}}>{message}</div>}
  {scores.length===0?<p>Ingen beregnede lagpoeng for denne runden ennå.</p>:<div style={{display:"grid",gap:12}}>{scores.map(s=><div key={s.team_round_points_id} style={{border:"1px solid #d1d5db",borderRadius:12,overflow:"hidden"}}>
   <button onClick={()=>toggleBreakdown(s)} style={{width:"100%",padding:14,border:0,textAlign:"left",display:"grid",gridTemplateColumns:"1fr repeat(4,auto)",gap:16,alignItems:"center",cursor:"pointer"}}>
    <b>{openScore===s.team_round_points_id?"▾":"▸"} {s.team_name}</b><span>Base <b>{n(s.base_points)}</b></span><span>C-bonus <b>{n(s.captain_bonus)}</b></span><span>VC-bonus <b>{n(s.vice_captain_bonus)}</b></span><span><b>{n(s.total_points)} FP</b></span>
   </button>
   {openScore===s.team_round_points_id&&<div style={{overflowX:"auto",padding:"0 12px 12px"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:14}}><thead><tr><th style={{textAlign:"left",padding:8}}>Spiller</th><th>Pos</th><th>Kamper</th><th>Spilt</th><th>Rå FP</th><th>Mult.</th><th>Bonus</th><th>Total</th></tr></thead><tbody>{(breakdowns[s.team_round_points_id]||[]).map(p=><tr key={p.player_id} style={{borderTop:"1px solid #e5e7eb"}}><td style={{padding:8}}><b>{p.player_name}</b>{p.is_captain?" 👑":p.is_vice_captain?" VC":""}<div style={{fontSize:12,opacity:.7}}>{p.team}</div></td><td style={{textAlign:"center"}}>{p.position}</td><td style={{textAlign:"center"}}>{p.games_played}</td><td style={{textAlign:"center"}}>{p.played?"Ja":"Nei"}</td><td style={{textAlign:"right"}}>{n(p.raw_points)}</td><td style={{textAlign:"right"}}>×{n(p.multiplier)}</td><td style={{textAlign:"right"}}>{n(p.bonus_points)}</td><td style={{textAlign:"right"}}><b>{n(p.total_points)}</b></td></tr>)}</tbody></table></div>}
  </div>)}</div>}
 </main>;
}
