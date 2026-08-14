"use client";

import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "../../../lib/supabase";

const SEASON="2026/27";
type Status={teamName:string;players:number;captain:boolean;vice:boolean;teamCost:number;roundNo:number|null;deadline:string|null;used:number;remaining:number};
const fmt=(v:string)=>new Intl.DateTimeFormat("nb-NO",{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/Oslo"}).format(new Date(v));

export default function TeamLaunchStatus(){
 const[data,setData]=useState<Status|null>(null),[message,setMessage]=useState("");
 useEffect(()=>{(async()=>{try{
  const sb=getSupabaseBrowserClient();if(!sb)return;
  const{data:s}=await sb.auth.getSession();const user=s.session?.user;if(!user)return;
  const{data:team}=await sb.from("fantasy_user_teams").select("id,name").eq("season",SEASON).eq("user_id",user.id).maybeSingle();
  if(!team){setMessage("Første gang? Velg 12 spillere, sett C og VC, og lagre laget.");return}
  const[{data:tp},{data:ts}]=await Promise.all([sb.from("fantasy_user_team_players").select("player_id,is_captain,is_vice_captain").eq("team_id",team.id),sb.rpc("get_fantasy_transfer_status_v1",{p_season:SEASON})]);
  const rows=tp||[],st=Array.isArray(ts)?ts[0]:null;
  setData({teamName:team.name||"Mitt lag",players:rows.length,captain:rows.some((r:any)=>r.is_captain),vice:rows.some((r:any)=>r.is_vice_captain),teamCost:Number(st?.team_cost||0),roundNo:st?.effective_round_no?Number(st.effective_round_no):null,deadline:st?.deadline_at||null,used:Number(st?.transfers_used||0),remaining:Number(st?.transfers_remaining??2)});
 }catch(e:any){setMessage(e?.message||String(e))}})()},[]);
 const ready=Boolean(data&&data.players===12&&data.captain&&data.vice&&data.teamCost<=100);
 return <section className={`team-launch-status ${ready?"ready":"needs-work"}`}>
  <div className="team-launch-title"><div><span>{ready?"✓ LAGRET OG KLART":"FØR DU ER KLAR"}</span><strong>{data?.teamName||"Opprett fantasy-laget ditt"}</strong></div>{data?.deadline&&<div className="team-launch-deadline"><small>{data.roundNo?`Runde ${data.roundNo} · deadline`:"Neste deadline"}</small><b>{fmt(data.deadline)}</b></div>}</div>
  {message?<p>{message}</p>:data&&<div className="team-launch-checks"><span className={data.players===12?"ok":""}>12 spillere: {data.players}/12</span><span className={data.captain&&data.vice?"ok":""}>C ×2 og VC ×1,5</span><span className={data.teamCost<=100?"ok":""}>Lagverdi {data.teamCost.toFixed(1)}m / 100m</span><span className="ok">Bytter {data.used}/2 · {data.remaining} igjen</span></div>}
  <small className="team-launch-note">Dette viser det som er lagret. Endringer i lagbyggeren gjelder først når du trykker «Lagre».</small>
 </section>;
}
