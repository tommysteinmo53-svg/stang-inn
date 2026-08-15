"use client";

import {useEffect,useMemo,useState} from "react";
import {getSupabaseBrowserClient} from "../../../../lib/supabase";
import "../../fantasy.css";
import "../xfp-admin.css";
import "./preseason.css";

type Game={id:number;game_date:string;starts_at:string|null;home_team:string;away_team:string;home_score:number|null;away_score:number|null;status:string;hockeylive_match_id:number|null;source_type:string;source_quality:number;source_url:string|null;notes:string|null};
type Stat={preseason_game_id:number;player_id:string|null};

const dt=(g:Game)=>g.starts_at?new Date(g.starts_at).toLocaleString("nb-NO",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):new Date(`${g.game_date}T12:00:00`).toLocaleDateString("nb-NO",{day:"2-digit",month:"2-digit"})+" · tid ukjent";

export default function PreseasonAdminPage(){
 const[token,setToken]=useState<string|null>(null),[games,setGames]=useState<Game[]>([]),[stats,setStats]=useState<Stat[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState("Laster preseason-data …");

 useEffect(()=>{(async()=>{try{const sb=getSupabaseBrowserClient();if(!sb)throw new Error("Supabase er ikke tilgjengelig");const{data}=await sb.auth.getSession();const access=data.session?.access_token;if(!access)throw new Error("Du må være logget inn");setToken(access);await load()}catch(e:any){setMessage(e?.message||"Kunne ikke laste preseason")}})()},[]);

 async function load(){const sb=getSupabaseBrowserClient();if(!sb)return;const[{data:g,error:ge},{data:s,error:se}]=await Promise.all([sb.from("fantasy_preseason_games").select("id,game_date,starts_at,home_team,away_team,home_score,away_score,status,hockeylive_match_id,source_type,source_quality,source_url,notes").eq("season","2026/27").order("game_date").order("starts_at"),sb.from("fantasy_preseason_player_stats").select("preseason_game_id,player_id")]);if(ge)throw ge;if(se)throw se;setGames((g||[]) as Game[]);setStats((s||[]) as Stat[]);setMessage(`${(g||[]).length} treningskamper · ${(s||[]).length} spillerlinjer`) }

 async function run(path:string,label:string){if(!token)return;setBusy(true);setMessage(`${label} …`);try{const res=await fetch(path,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:path.includes("preseason-import")?JSON.stringify({all:true}):JSON.stringify({}),cache:"no-store"});const body=await res.json();if(!res.ok||!body.ok)throw new Error(body.error||`${label} feilet`);await load();const failed=Number(body.failed||0);setMessage(`${label} fullført ✓${failed?` · ${failed} feilet`:""}`)}catch(e:any){setMessage(e?.message||`${label} feilet`)}finally{setBusy(false)}}

 const counts=useMemo(()=>{const m=new Map<number,{rows:number,matched:number}>();for(const s of stats){const x=m.get(s.preseason_game_id)||{rows:0,matched:0};x.rows++;if(s.player_id)x.matched++;m.set(s.preseason_game_id,x)}return m},[stats]);
 const hockeylive=games.filter(g=>g.hockeylive_match_id).length,finished=games.filter(g=>g.status==="finished").length,external=games.filter(g=>g.source_type==="web"||g.source_type==="official").length;

 return <main className="fantasy-shell xfp-command-center preseason-admin">
  <section className="xfp-command-hero"><p className="fantasy-kicker">STANG INN · ADMIN ANALYSE</p><h1>Preseason-form</h1><p>Isolert treningskampdata for xFP. Ingenting her påvirker faktisk Fantasy-scoring.</p></section>

  <section className="xfp-panel">
   <div className="xfp-panel-head"><div><p className="eyebrow">PRESEASON 2026/27</p><h2>Datapipeline</h2><p>HockeyLive brukes når tilgjengelig. Utenlandske/andre kamper fylles fra dokumenterte eksterne kilder med egen datakvalitet.</p></div><a className="xfp-secondary" href="/fantasy/admin-analysis" style={{textDecoration:"none"}}>← Kommandosenter</a></div>
   <div className="preseason-actions"><button className="xfp-primary" disabled={busy} onClick={()=>run("/api/admin/fantasy/preseason-import","HockeyLive-import")}>🏒 Importer HockeyLive</button><button className="xfp-primary" disabled={busy} onClick={()=>run("/api/admin/fantasy/preseason-external","Ekstern import")}>🌍 Importer eksterne kilder</button><button className="xfp-secondary" disabled={busy} onClick={()=>load()}>↻ Oppdater</button></div>
   <p className="preseason-message">{message}</p>
   <div className="preseason-summary"><div><span>Kamper</span><strong>{games.length}</strong></div><div><span>Ferdige</span><strong>{finished}</strong></div><div><span>HockeyLive-ID</span><strong>{hockeylive}</strong></div><div><span>Ekstern kilde</span><strong>{external}</strong></div><div><span>Spillerlinjer</span><strong>{stats.length}</strong></div></div>
  </section>

  <section className="xfp-panel"><div className="xfp-panel-head"><div><p className="eyebrow">KAMPSTATUS</p><h2>Treningskamper</h2></div></div>
   <div className="preseason-table-wrap"><table className="preseason-table"><thead><tr><th>Dato</th><th>Kamp</th><th>Resultat</th><th>Kilde</th><th>Data</th><th>Match</th></tr></thead><tbody>{games.map(g=>{const c=counts.get(g.id)||{rows:0,matched:0};return <tr key={g.id}><td>{dt(g)}</td><td><strong>{g.home_team} – {g.away_team}</strong><small>{g.hockeylive_match_id?`HockeyLive ${g.hockeylive_match_id}`:g.source_url?"Ekstern kilde":"Manuell/venter"}</small></td><td>{g.home_score==null||g.away_score==null?"—":`${g.home_score}–${g.away_score}`}</td><td><span className={`preseason-source ${g.source_type}`}>{g.source_type}</span><small>{Math.round(Number(g.source_quality||0)*100)}%</small></td><td>{c.rows}</td><td>{c.rows?`${c.matched}/${c.rows}`:"—"}</td></tr>})}</tbody></table></div>
  </section>
 </main>;
}
