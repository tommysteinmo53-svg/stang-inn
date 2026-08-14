"use client";

import {useEffect,useMemo,useState} from "react";
import {getSupabaseBrowserClient} from "../../../lib/supabase";
import "../fantasy.css";

type Player={id:string;name:string;team:string;position:"C"|"W"|"D"|"G";price:number};
type Rules={max_players_per_club:number;captain_multiplier:number;vice_captain_enabled:boolean};
const LIMITS:{[K in Player["position"]]:number}={C:2,W:4,D:4,G:2};
const BUDGET=100;

export default function FantasyTeamPage(){
 const[players,setPlayers]=useState<Player[]>([]),[selected,setSelected]=useState<string[]>([]),[teamName,setTeamName]=useState("Mitt lag"),[msg,setMsg]=useState("Laster spillerpool …"),[busy,setBusy]=useState(false),[filter,setFilter]=useState<"ALL"|Player["position"]>("ALL"),[q,setQ]=useState("");
 const[rules,setRules]=useState<Rules>({max_players_per_club:3,captain_multiplier:2,vice_captain_enabled:true});
 const[captain,setCaptain]=useState<string|null>(null),[viceCaptain,setViceCaptain]=useState<string|null>(null);
 useEffect(()=>{(async()=>{try{const s=getSupabaseBrowserClient();if(!s)throw new Error("Supabase er ikke tilgjengelig");const{data:session}=await s.auth.getSession();if(!session.session)throw new Error("Du må være logget inn");
 const[{data:p,error},{data:r}]=await Promise.all([
  s.from("fantasy_players").select("id,name,team,position,price").not("price","is",null).in("position",["C","W","D","G"]).order("price",{ascending:false}),
  s.from("fantasy_season_rules").select("max_players_per_club,captain_multiplier,vice_captain_enabled").eq("season","2026/27").maybeSingle()
 ]);if(error)throw error;const pool=(p||[]).map((x:any)=>({...x,price:Number(x.price)})) as Player[];setPlayers(pool);if(r)setRules({max_players_per_club:Number(r.max_players_per_club),captain_multiplier:Number(r.captain_multiplier),vice_captain_enabled:Boolean(r.vice_captain_enabled)});
 const{data:t}=await s.from("fantasy_user_teams").select("id,name").eq("season","2026/27").maybeSingle();if(t){setTeamName(t.name||"Mitt lag");const{data:tp}=await s.from("fantasy_user_team_players").select("player_id,is_captain,is_vice_captain").eq("team_id",t.id);setSelected((tp||[]).map((x:any)=>x.player_id));setCaptain((tp||[]).find((x:any)=>x.is_captain)?.player_id||null);setViceCaptain((tp||[]).find((x:any)=>x.is_vice_captain)?.player_id||null);}
 setMsg(`${pool.length} prisede spillere klare`)}catch(e:any){setMsg(`Kunne ikke laste lagbygger: ${e.message||e}`)}})()},[]);
 const chosen=useMemo(()=>selected.map(id=>players.find(p=>p.id===id)).filter(Boolean) as Player[],[selected,players]);
 const total=chosen.reduce((s,p)=>s+p.price,0),left=BUDGET-total;
 const counts=useMemo(()=>({C:chosen.filter(p=>p.position==="C").length,W:chosen.filter(p=>p.position==="W").length,D:chosen.filter(p=>p.position==="D").length,G:chosen.filter(p=>p.position==="G").length}),[chosen]);
 const clubCounts=useMemo(()=>{const m=new Map<string,number>();for(const p of chosen)m.set(p.team,(m.get(p.team)||0)+1);return m},[chosen]);
 const clubOverflow=[...clubCounts.entries()].find(([,n])=>n>rules.max_players_per_club);
 const valid=selected.length===12&&left>=0&&counts.C===2&&counts.W===4&&counts.D===4&&counts.G===2&&!clubOverflow&&!!captain&&!!viceCaptain&&captain!==viceCaptain;
 const visible=players.filter(p=>(filter==="ALL"||p.position===filter)&&(!q||`${p.name} ${p.team}`.toLowerCase().includes(q.toLowerCase())));
 function toggle(p:Player){if(selected.includes(p.id)){setSelected(selected.filter(x=>x!==p.id));if(captain===p.id)setCaptain(null);if(viceCaptain===p.id)setViceCaptain(null);return}if(selected.length>=12){setMsg("Laget har allerede 12 spillere");return}if(counts[p.position]>=LIMITS[p.position]){setMsg(`Du har allerede maks ${LIMITS[p.position]} ${p.position}`);return}if((clubCounts.get(p.team)||0)>=rules.max_players_per_club){setMsg(`Maks ${rules.max_players_per_club} spillere fra ${p.team}`);return}if(total+p.price>BUDGET){setMsg(`Budsjettet overskrides med ${(total+p.price-BUDGET).toFixed(1)}m`);return}setSelected([...selected,p.id]);setMsg(`${p.name} lagt til`)}
 function setC(id:string){setCaptain(id);if(viceCaptain===id)setViceCaptain(null);setMsg("Kaptein valgt")}
 function setVC(id:string){setViceCaptain(id);if(captain===id)setCaptain(null);setMsg("Visekaptein valgt")}
 async function save(){if(!valid)return;setBusy(true);try{const s=getSupabaseBrowserClient();if(!s)throw new Error("Supabase er ikke tilgjengelig");const{data,error}=await s.rpc("save_fantasy_team_v2",{p_season:"2026/27",p_name:teamName,p_player_ids:selected,p_captain:captain,p_vice_captain:viceCaptain});if(error)throw error;setMsg(`Lag lagret ✓ · ID ${data}`)}catch(e:any){setMsg(`Lagring stoppet: ${e.message||e}`)}finally{setBusy(false)}}
 return <main className="fantasy-shell"><section className="fantasy-hero"><div><p className="fantasy-kicker">STANG INN · FANTASY 2026/27</p><h1>Bygg laget ditt</h1><p className="fantasy-lead">12 spillere · 2C · 4W · 4D · 2G · maks 100,0m · maks {rules.max_players_per_club} fra samme klubb.</p></div></section>
 <section className="fantasy-metrics"><article><span>Spillere</span><strong>{selected.length}/12</strong></article><article><span>Brukt</span><strong>{total.toFixed(1)}m</strong></article><article><span>Igjen</span><strong>{left.toFixed(1)}m</strong></article><article><span>Status</span><strong>{valid?"✓ Klar":"Bygg lag"}</strong></article></section>
 <section className="fantasy-grid"><div className="fantasy-card fantasy-main-card"><p className="eyebrow">DITT LAG</p><h2>{teamName}</h2><input value={teamName} onChange={e=>setTeamName(e.target.value)} style={{padding:10,borderRadius:10,width:"100%",maxWidth:320,marginBottom:12}}/>
 <p className="card-copy">Velg én kaptein og én visekaptein. Kapteinsmultiplikator er foreløpig {rules.captain_multiplier.toFixed(1)}×.</p>
 {(["C","W","D","G"] as const).map(pos=><div key={pos} style={{marginBottom:14}}><b>{pos} · {counts[pos]}/{LIMITS[pos]}</b><div>{chosen.filter(p=>p.position===pos).map(p=><div key={p.id} style={{display:"flex",gap:6,alignItems:"center",marginTop:6,flexWrap:"wrap"}}><button onClick={()=>toggle(p)} style={{flex:"1 1 260px",textAlign:"left"}}>{p.name} · {p.team} · {p.price.toFixed(1)}m ✕</button><button onClick={()=>setC(p.id)} disabled={captain===p.id}>{captain===p.id?"👑 C":"C"}</button><button onClick={()=>setVC(p.id)} disabled={viceCaptain===p.id}>{viceCaptain===p.id?"⭐ VC":"VC"}</button></div>)}</div></div>)}
 {clubOverflow&&<p className="card-copy"><strong>⛔ For mange spillere fra {clubOverflow[0]}: {clubOverflow[1]}/{rules.max_players_per_club}</strong></p>}
 {!captain||!viceCaptain?<p className="card-copy"><strong>Velg kaptein og visekaptein før laget kan lagres.</strong></p>:null}
 <button onClick={save} disabled={!valid||busy}>{busy?"Lagrer …":"Lagre lag"}</button><p className="card-copy"><strong>{msg}</strong></p></div>
 <div className="fantasy-card"><p className="eyebrow">SPILLERPOOL</p><h2>Velg spillere</h2><input placeholder="Søk spiller eller lag" value={q} onChange={e=>setQ(e.target.value)} style={{padding:10,borderRadius:10,width:"100%",marginBottom:8}}/><div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>{(["ALL","C","W","D","G"] as const).map(x=><button key={x} onClick={()=>setFilter(x)} disabled={filter===x}>{x}</button>)}</div><div style={{maxHeight:650,overflowY:"auto"}}>{visible.map(p=>{const on=selected.includes(p.id),clubFull=(clubCounts.get(p.team)||0)>=rules.max_players_per_club;return <button key={p.id} onClick={()=>toggle(p)} style={{display:"block",width:"100%",textAlign:"left",marginBottom:6,opacity:on?.55:clubFull?.6:1}} disabled={on}>{p.name}<br/><small>{p.team} · {p.position} · {p.price.toFixed(1)}m{clubFull&&!on?` · klubbgrense ${rules.max_players_per_club}/${rules.max_players_per_club}`:""}</small></button>})}</div></div></section></main>
}
