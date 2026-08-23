"use client";

import {useEffect,useMemo,useState} from "react";
import {getSupabaseBrowserClient} from "../../../lib/supabase";
import "./bonus-cards.css";

type BoosterType="captain_boost"|"line_boost"|"transfer_boost";
type BoosterRow={booster_type:BoosterType;activation_id:string|null;activation_status:string;round_id:string|null;round_no:number|null;round_name:string|null;deadline_at:string|null;can_select:boolean;can_cancel:boolean;transfers_used:number};
type Round={id:string;round_no:number;deadline_at:string};
const SEASON="2026/27";
const META:Record<BoosterType,{icon:string;title:string;short:string;detail:string}>={
 captain_boost:{icon:"⭐",title:"Kapteinsboost",short:"Kapteinen får ×2,5",detail:"Kapteinen får ×2,5 i stedet for ×2. Gjelder alle kampene hans i fantasy-runden."},
 line_boost:{icon:"🔥",title:"Rekkeboost",short:"Rekke 2 teller 100 %",detail:"Rekke 2 teller 100 % denne runden i stedet for 50 %. Kaptein og visekaptein fungerer normalt."},
 transfer_boost:{icon:"🔄",title:"Bytteboost",short:"Opptil 4 spillerbytter",detail:"Gjør opptil 4 spillerbytter denne runden i stedet for 2. Byttene er permanente. Kortet låses når bytte nummer 3 gjennomføres."}
};
const order:BoosterType[]=["captain_boost","line_boost","transfer_boost"];

export default function BonusCards(){
 const[rows,setRows]=useState<BoosterRow[]>([]),[rounds,setRounds]=useState<Round[]>([]),[choice,setChoice]=useState<Record<string,string>>({}),[busy,setBusy]=useState<string|null>(null),[msg,setMsg]=useState("");
 async function load(){
  const s=getSupabaseBrowserClient();if(!s)return;
  const[{data:b,error},{data:r,error:re}]=await Promise.all([
   s.rpc("get_my_fantasy_boosters_v1",{p_season:SEASON}),
   s.from("fantasy_rounds").select("id,round_no,deadline_at").eq("season",SEASON).lt("round_no",9000).order("round_no")
  ]);
  if(error){setMsg(`Kunne ikke laste boosterkort: ${error.message}`);return}if(re){setMsg(`Kunne ikke laste runder: ${re.message}`);return}
  const next=(b||[]).map((x:any)=>({...x,round_no:x.round_no==null?null:Number(x.round_no),transfers_used:Number(x.transfers_used||0)})) as BoosterRow[];
  setRows(next);setRounds(((r||[]) as any[]).map(x=>({id:String(x.id),round_no:Number(x.round_no),deadline_at:String(x.deadline_at)})));
  setChoice(Object.fromEntries(next.filter(x=>x.round_id).map(x=>[x.booster_type,x.round_id!])))
 }
 useEffect(()=>{load()},[]);
 const byType=useMemo(()=>new Map(rows.map(x=>[x.booster_type,x])),[rows]);
 const openRounds=rounds.filter(r=>new Date(r.deadline_at).getTime()>Date.now());
 async function select(type:BoosterType){const roundId=choice[type];if(!roundId){setMsg("Velg en fantasy-runde først");return}setBusy(type);setMsg("");try{const s=getSupabaseBrowserClient();if(!s)throw new Error("Supabase er ikke tilgjengelig");const{error}=await s.rpc("select_fantasy_booster_v1",{p_season:SEASON,p_booster_type:type,p_round_id:roundId});if(error)throw error;await load();setMsg(`${META[type].title} er valgt. Du kan endre valget frem til deadline så lenge kortet ikke er låst.`)}catch(e:any){setMsg(e.message||String(e))}finally{setBusy(null)}}
 async function cancel(type:BoosterType){setBusy(type);setMsg("");try{const s=getSupabaseBrowserClient();if(!s)throw new Error("Supabase er ikke tilgjengelig");const{error}=await s.rpc("cancel_fantasy_booster_v1",{p_season:SEASON,p_booster_type:type});if(error)throw error;await load();setMsg(`${META[type].title} er trukket tilbake og kan velges på nytt.`)}catch(e:any){setMsg(e.message||String(e))}finally{setBusy(null)}}
 return <section className="bonus-zone" aria-labelledby="bonus-title">
  <div className="bonus-heading"><div><p className="fantasy-kicker">BONUS WEEKS</p><h2 id="bonus-title">Dine boosterkort</h2><p>Du har ett av hvert kort for hele sesongen. Velg selv når du vil bruke dem. Maks ett personlig boosterkort per fantasy-runde.</p></div><a href="/fantasy/rules">Se alle regler →</a></div>
  <div className="bonus-info"><strong>Viktig:</strong> Kortet må velges før rundens deadline. Kapteinsboost og Rekkeboost kan flyttes eller trekkes tilbake før deadline. Bytteboost låses når du gjør bytte nummer 3. Kortene kan ikke brukes i Rik Onkel eller Fattig Onkel.</div>
  <div className="bonus-grid">{order.map(type=>{const row=byType.get(type),m=META[type];const status=row?.activation_status||"available";const used=status==="used"||status==="committed";const selected=status==="selected";return <article className={`bonus-card ${selected?"selected":""} ${used?"used":""}`} key={type}>
   <div className="bonus-card-top"><span className="bonus-icon">{m.icon}</span><span className={`bonus-status ${status}`}>{status==="available"||status==="cancelled"?"TILGJENGELIG":status==="selected"?"VALGT":status==="committed"?"LÅST":"BRUKT"}</span></div>
   <h3>{m.title}</h3><strong className="bonus-effect">{m.short}</strong><p>{m.detail}</p>
   {row?.round_no&&status!=="cancelled"&&<div className="bonus-current">Valgt: <b>Runde {row.round_no}</b>{row.deadline_at&&<> · deadline {new Date(row.deadline_at).toLocaleString("nb-NO",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</>}</div>}
   {!used&&<><label>Velg fantasy-runde<select value={choice[type]||""} onChange={e=>setChoice(v=>({...v,[type]:e.target.value}))} disabled={busy===type}><option value="">Velg runde …</option>{openRounds.map(r=><option key={r.id} value={r.id}>Runde {r.round_no} · {new Date(r.deadline_at).toLocaleDateString("nb-NO",{day:"2-digit",month:"2-digit"})}</option>)}</select></label><button className="bonus-primary" onClick={()=>select(type)} disabled={busy===type||!row?.can_select}>{busy===type?"Lagrer …":selected?"Flytt / bekreft kort":"Bruk kort i valgt runde"}</button></>}
   {selected&&row?.can_cancel&&<button className="bonus-cancel" onClick={()=>cancel(type)} disabled={busy===type}>Trekk tilbake</button>}
   {type==="transfer_boost"&&selected&&<small>{row?.transfers_used||0} bytter registrert i valgt runde.</small>}
  </article>})}</div>
  {msg&&<p className="bonus-message" role="status">{msg}</p>}
 </section>
}
