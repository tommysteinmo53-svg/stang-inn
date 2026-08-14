"use client";

import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "../../../lib/supabase";
import "../fantasy.css";

const SEASON="2026/27";
type League={league_id:string;league_name:string;invite_code:string;my_role:string;member_count:number;created_at:string};

export default function FantasyLeaguesPage(){
 const[auth,setAuth]=useState<boolean|null>(null),[hasTeam,setHasTeam]=useState(false),[rows,setRows]=useState<League[]>([]),[name,setName]=useState(""),[code,setCode]=useState(""),[busy,setBusy]=useState(false),[msg,setMsg]=useState("");
 async function load(){const sb=getSupabaseBrowserClient();if(!sb)return;const{data:s}=await sb.auth.getSession();const user=s.session?.user;if(!user){setAuth(false);return}setAuth(true);const{data:t}=await sb.from("fantasy_user_teams").select("id").eq("season",SEASON).eq("user_id",user.id).maybeSingle();setHasTeam(Boolean(t));const{data,error}=await sb.rpc("get_my_fantasy_private_leagues_v1",{p_season:SEASON});if(error)setMsg(error.message);else setRows((data||[]) as League[])}
 useEffect(()=>{load()},[]);
 async function createLeague(){setBusy(true);setMsg("");try{const sb=getSupabaseBrowserClient();if(!sb)throw new Error("Supabase er ikke tilgjengelig");const{data,error}=await sb.rpc("create_fantasy_private_league_v1",{p_season:SEASON,p_name:name});if(error)throw error;setName("");await load();if(data)location.href=`/fantasy/leagues/${data}`;}catch(e:any){setMsg(e?.message||String(e))}finally{setBusy(false)}}
 async function joinLeague(){setBusy(true);setMsg("");try{const sb=getSupabaseBrowserClient();if(!sb)throw new Error("Supabase er ikke tilgjengelig");const{data,error}=await sb.rpc("join_fantasy_private_league_v1",{p_season:SEASON,p_invite_code:code});if(error)throw error;setCode("");await load();if(data)location.href=`/fantasy/leagues/${data}`;}catch(e:any){setMsg(e?.message||String(e))}finally{setBusy(false)}}
 if(auth===null)return <main className="fantasy-shell"><p className="fantasy-lead">Laster private ligaer …</p></main>;
 if(!auth)return <main className="fantasy-shell"><section className="team-panel"><h1>Private ligaer</h1><p className="team-muted">Du må være logget inn.</p></section></main>;
 return <main className="fantasy-shell">
  <section className="fantasy-hero"><div><p className="fantasy-kicker">STANG INN · EHL FANTASY 2026/27</p><h1>Private ligaer</h1><p className="fantasy-lead">Lag en liga for vennegjengen eller bli med via invitasjonskode. Det samme fantasylaget ditt brukes i alle ligaene.</p></div><a className="pill" href="/fantasy">← Fantasy</a></section>
  {!hasTeam&&<section className="fantasy-card" style={{marginTop:18}}><h2>Du trenger et fantasylag først</h2><p className="card-copy">Opprett laget ditt før du lager eller blir med i en privat liga.</p><a href="/fantasy/team" className="pill" style={{display:"inline-block",marginTop:12,textDecoration:"none"}}>Bygg laget →</a></section>}
  {hasTeam&&<section className="fantasy-grid" style={{marginTop:18}}><article className="fantasy-card"><p className="eyebrow">OPPRETT LIGA</p><h2>Start en privat liga</h2><input value={name} onChange={e=>setName(e.target.value)} placeholder="Ligavn" maxLength={60} style={{width:"100%",padding:12,borderRadius:10,border:"1px solid #d6dee8"}}/><button onClick={createLeague} disabled={busy||name.trim().length<2}>{busy?"Jobber …":"Opprett liga"}</button></article><article className="fantasy-card"><p className="eyebrow">BLI MED</p><h2>Har du en kode?</h2><input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="8 tegn" maxLength={12} style={{width:"100%",padding:12,borderRadius:10,border:"1px solid #d6dee8",textTransform:"uppercase"}}/><button onClick={joinLeague} disabled={busy||code.replace(/[^A-Z0-9]/g,"").length!==8}>{busy?"Jobber …":"Bli med i liga"}</button></article></section>}
  {msg&&<p className="team-error">{msg}</p>}
  <section className="fantasy-card" style={{marginTop:18}}><div className="card-heading"><div><p className="eyebrow">MINE LIGAER</p><h2>Private konkurranser</h2></div><span className="pill">{rows.length}</span></div>{rows.length===0?<p className="card-copy">Du er ikke med i noen private ligaer ennå.</p>:<div className="recommendation-list">{rows.map(l=><a key={l.league_id} href={`/fantasy/leagues/${l.league_id}`} className="recommendation" style={{textDecoration:"none",color:"inherit",gridTemplateColumns:"1fr auto"}}><div><strong>{l.league_name}</strong><p>{l.member_count} medlem{l.member_count===1?"":"mer"} · {l.my_role==="owner"?"Eier":"Medlem"}</p></div><div style={{textAlign:"right"}}><span className="pill">{l.invite_code}</span><div style={{marginTop:8,fontWeight:800}}>Åpne →</div></div></a>)}</div>}</section>
 </main>
}
