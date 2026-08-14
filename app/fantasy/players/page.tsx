"use client";

import {useEffect,useMemo,useState} from "react";
import {getSupabaseBrowserClient} from "../../../lib/supabase";
import "../fantasy.css";

const SEASON="2026/27";
type Player={id:string;name:string;team:string;position:string;price:number};

export default function FantasyPlayersPage(){
 const[players,setPlayers]=useState<Player[]>([]),[busy,setBusy]=useState(true),[message,setMessage]=useState("");
 const[q,setQ]=useState(""),[teamFilter,setTeamFilter]=useState("ALL"),[posFilter,setPosFilter]=useState("ALL");

 useEffect(()=>{(async()=>{try{
  const sb=getSupabaseBrowserClient();if(!sb)throw new Error("Supabase er ikke tilgjengelig");
  const{data:s}=await sb.auth.getSession();if(!s.session)throw new Error("Du må være logget inn");
  const[{data:p,error},{data:prices,error:pe}]=await Promise.all([
   sb.from("fantasy_players").select("id,name,team,position").in("position",["C","W","D","G"]).order("name"),
   sb.from("fantasy_player_season_prices").select("player_id,price").eq("season",SEASON)
  ]);
  if(error)throw error;if(pe)throw pe;
  const priceMap=new Map((prices||[]).map((x:any)=>[x.player_id,Number(x.price)]));
  setPlayers((p||[]).filter((x:any)=>priceMap.has(x.id)).map((x:any)=>({...x,price:priceMap.get(x.id)!})));
 }catch(e:any){setMessage(`Kunne ikke hente spillere: ${e.message||e}`)}finally{setBusy(false)}})()},[]);

 const teams=useMemo(()=>Array.from(new Set(players.map(p=>p.team))).sort((a,b)=>a.localeCompare(b,"nb")),[players]);
 const filtered=useMemo(()=>players.filter(p=>{
  const search=!q||`${p.name} ${p.team}`.toLowerCase().includes(q.toLowerCase());
  const team=teamFilter==="ALL"||p.team===teamFilter;
  const pos=posFilter==="ALL"||(posFilter==="F"?(p.position==="C"||p.position==="W"):p.position===posFilter);
  return search&&team&&pos;
 }),[players,q,teamFilter,posFilter]);

 return <main className="fantasy-shell">
  <section className="team-builder-head"><div><p className="fantasy-kicker">STANG INN · FANTASY 2026/27</p><h1>Spillere</h1><p>Se alle spillere med låst sesongpris og åpne spillerprofilen for mer statistikk.</p></div></section>
  <section className="team-panel" style={{marginTop:18}}>
   <div className="team-panel-top" style={{gap:12,flexWrap:"wrap"}}><input className="team-search" value={q} onChange={e=>setQ(e.target.value)} placeholder="Søk etter spiller eller lag …"/><select className="team-line-select" value={teamFilter} onChange={e=>setTeamFilter(e.target.value)}><option value="ALL">Alle lag</option>{teams.map(t=><option key={t} value={t}>{t}</option>)}</select><select className="team-line-select" value={posFilter} onChange={e=>setPosFilter(e.target.value)}><option value="ALL">Alle posisjoner</option><option value="F">Forward</option><option value="D">Back</option><option value="G">Keeper</option></select></div>
   {message&&<p className="team-message">{message}</p>}
   {busy?<p className="team-muted">Henter spillere …</p>:<div className="team-pool-list" style={{marginTop:14}}>{filtered.map(p=><a key={p.id} href={`/fantasy/players/${p.id}`} className="team-pool-player" style={{textDecoration:"none",color:"inherit"}}><div><strong>{p.name}</strong><small>{p.team} · {p.position==="C"||p.position==="W"?"F":p.position}</small></div><span className="team-price">{p.price.toFixed(1)}m</span></a>)}{!filtered.length&&<p className="team-muted">Ingen spillere matcher filtrene.</p>}</div>}
  </section>
 </main>;
}
