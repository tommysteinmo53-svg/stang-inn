"use client";

import {useEffect,useMemo,useState} from "react";
import {getSupabaseBrowserClient} from "../../../lib/supabase";
import "../fantasy.css";

type Player={id:string;name:string;team:string;position:"C"|"W"|"D"|"G";price:number};
const LIMITS:{[K in Player["position"]]:number}={C:2,W:4,D:4,G:2};
const BUDGET=100;

export default function FantasyTeamPage(){
 const[players,setPlayers]=useState<Player[]>([]),[selected,setSelected]=useState<string[]>([]),[teamName,setTeamName]=useState("Mitt lag"),[msg,setMsg]=useState("Laster spillerpool …"),[busy,setBusy]=useState(false),[filter,setFilter]=useState<"ALL"|Player["position"]>("ALL"),[q,setQ]=useState("");
 useEffect(()=>{(async()=>{try{const s=getSupabaseBrowserClient();if(!s)throw new Error("Supabase er ikke tilgjengelig");const{data:session}=await s.auth.getSession();if(!session.session)throw new Error("Du må være logget inn");const{data:p,error}=await s.from("fantasy_players").select("id,name,team,position,price").not("price","is",null).in("position",["C","W","D","G"]).order("price",{ascending:false});if(error)throw error;const pool=(p||[]).map((x:any)=>({...x,price:Number(x.price)})) as Player[];setPlayers(pool);
 const{data:t}=await s.from("fantasy_user_teams").select("id,name").eq("season","2026/27").maybeSingle();if(t){setTeamName(t.name||"Mitt lag");const{data:tp}=await s.from("fantasy_user_team_players").select("player_id").eq("team_id",t.id);setSelected((tp||[]).map((x:any)=>x.player_id));}
 setMsg(`${pool.length} prisede spillere klare`)}catch(e:any){setMsg(`Kunne ikke laste lagbygger: ${e.message||e}`)}})()},[]);
 const chosen=useMemo(()=>selected.map(id=>players.find(p=>p.id===id)).filter(Boolean) as Player[],[selected,players]);
 const total=chosen.reduce((s,p)=>s+p.price,0),left=BUDGET-total;
 const counts=useMemo(()=>({C:chosen.filter(p=>p.position==="C").length,W:chosen.filter(p=>p.position==="W").length,D:chosen.filter(p=>p.position==="D").length,G:chosen.filter(p=>p.position==="G").length}),[chosen]);
 const valid=selected.length===12&&left>=0&&counts.C===2&&counts.W===4&&counts.D===4&&counts.G===2;
 const visible=players.filter(p=>(filter==="ALL"||p.position===filter)&&(!q||`${p.name} ${p.team}`.toLowerCase().includes(q.toLowerCase())));
 function toggle(p:Player){if(selected.includes(p.id)){setSelected(selected.filter(x=>x!==p.id));return}if(selected.length>=12){setMsg("Laget har allerede 12 spillere");return}if(counts[p.position]>=LIMITS[p.position]){setMsg(`Du har allerede maks ${LIMITS[p.position]} ${p.position}`);return}if(total+p.price>BUDGET){setMsg(`Budsjettet overskrides med ${(total+p.price-BUDGET).toFixed(1)}m`);return}setSelected([...selected,p.id]);setMsg(`${p.name} lagt til`)}
 async function save(){if(!valid)return;setBusy(true);try{const s=getSupabaseBrowserClient();if(!s)throw new Error("Supabase er ikke tilgjengelig");const{data,error}=await s.rpc("save_fantasy_team_v1",{p_season:"2026/27",p_name:teamName,p_player_ids:selected});if(error)throw error;setMsg(`Lag lagret ✓ · ID ${data}`)}catch(e:any){setMsg(`Lagring stoppet: ${e.message||e}`)}finally{setBusy(false)}}
 return <main className="fantasy-shell"><section className="fantasy-hero"><div><p className="fantasy-kicker">STANG INN · FANTASY 2026/27</p><h1>Bygg laget ditt</h1><p className="fantasy-lead">12 spillere · 2C · 4W · 4D · 2G · maks 100,0m.</p></div></section>
 <section className="fantasy-metrics"><article><span>Spillere</span><strong>{selected.length}/12</strong></article><article><span>Brukt</span><strong>{total.toFixed(1)}m</strong></article><article><span>Igjen</span><strong>{left.toFixed(1)}m</strong></article><article><span>Status</span><strong>{valid?"✓ Klar":"Bygg lag"}</strong></article></section>
 <section className="fantasy-grid"><div className="fantasy-card fantasy-main-card"><p className="eyebrow">DITT LAG</p><h2>{teamName}</h2><input value={teamName} onChange={e=>setTeamName(e.target.value)} style={{padding:10,borderRadius:10,width:"100%",maxWidth:320,marginBottom:12}}/>
 {(["C","W","D","G"] as const).map(pos=><div key={pos} style={{marginBottom:14}}><b>{pos} · {counts[pos]}/{LIMITS[pos]}</b><div>{chosen.filter(p=>p.position===pos).map(p=><button key={p.id} onClick={()=>toggle(p)} style={{display:"block",width:"100%",textAlign:"left",marginTop:6}}>{p.name} · {p.team} · {p.price.toFixed(1)}m ✕</button>)}</div></div>)}
 <button onClick={save} disabled={!valid||busy}>{busy?"Lagrer …":"Lagre lag"}</button><p className="card-copy"><strong>{msg}</strong></p></div>
 <div className="fantasy-card"><p className="eyebrow">SPILLERPOOL</p><h2>Velg spillere</h2><input placeholder="Søk spiller eller lag" value={q} onChange={e=>setQ(e.target.value)} style={{padding:10,borderRadius:10,width:"100%",marginBottom:8}}/><div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>{(["ALL","C","W","D","G"] as const).map(x=><button key={x} onClick={()=>setFilter(x)} disabled={filter===x}>{x}</button>)}</div><div style={{maxHeight:650,overflowY:"auto"}}>{visible.map(p=>{const on=selected.includes(p.id);return <button key={p.id} onClick={()=>toggle(p)} style={{display:"block",width:"100%",textAlign:"left",marginBottom:6,opacity:on?.55:1}} disabled={on}>{p.name}<br/><small>{p.team} · {p.position} · {p.price.toFixed(1)}m</small></button>})}</div></div></section></main>
}
