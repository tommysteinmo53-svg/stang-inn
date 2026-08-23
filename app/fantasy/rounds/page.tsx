"use client";

import {useEffect,useMemo,useState} from "react";
import {getSupabaseBrowserClient} from "../../../lib/supabase";
import "../fantasy.css";
import "./rounds.css";

type Round={id:string;round_no:number;name:string|null;starts_at:string|null;deadline_at:string;ends_at:string|null;status:string};
type Game={game_id:string;fantasy_round_id:string;fantasy_round_no:number;starts_at:string|null;home_team:string;away_team:string};
const SEASON="2026/27";
const fmt=(v:string|null|undefined)=>v?new Intl.DateTimeFormat("nb-NO",{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/Oslo"}).format(new Date(v)):"—";
const statusLabel=(s:string)=>s==="finished"?"Ferdig":s==="locked"?"Låst":s==="open"?"Åpen":"Planlagt";

export default function FantasyRoundsPage(){
 const[auth,setAuth]=useState<boolean|null>(null),[rounds,setRounds]=useState<Round[]>([]),[games,setGames]=useState<Game[]>([]),[message,setMessage]=useState(""),[selected,setSelected]=useState<string|null>(null);
 useEffect(()=>{(async()=>{try{const sb=getSupabaseBrowserClient();if(!sb){setAuth(false);return}const{data:s}=await sb.auth.getSession();if(!s.session){setAuth(false);return}setAuth(true);const[{data:r,error},{data:g,error:ge}]=await Promise.all([sb.from("fantasy_rounds").select("id,round_no,name,starts_at,deadline_at,ends_at,status").eq("season",SEASON).lt("round_no",9000).order("round_no"),sb.rpc("get_fantasy_round_schedule_v1",{p_season:SEASON})]);if(error)throw error;if(ge)throw ge;setRounds((r||[]) as Round[]);setGames((g||[]) as Game[])}catch(e:any){setMessage(`Kunne ikke hente fantasy-runder: ${e?.message||e}`)}})()},[]);
 const gameMap=useMemo(()=>{const m=new Map<string,Game[]>();for(const g of games){const a=m.get(g.fantasy_round_id)||[];a.push(g);a.sort((x,y)=>(x.starts_at||"").localeCompare(y.starts_at||""));m.set(g.fantasy_round_id,a)}return m},[games]);
 const allTeams=useMemo(()=>Array.from(new Set(games.flatMap(g=>[g.home_team,g.away_team]))).sort((a,b)=>a.localeCompare(b,"nb")),[games]);
 const now=Date.now(),next=rounds.find(r=>new Date(r.deadline_at).getTime()>now)||null,finished=rounds.filter(r=>r.status==="finished").length,totalGames=games.length;
 useEffect(()=>{if(selected==null&&next)setSelected(next.id)},[next?.id]);
 const roundDistribution=(rg:Game[])=>{const counts=new Map<string,number>();for(const t of allTeams)counts.set(t,0);for(const g of rg){counts.set(g.home_team,(counts.get(g.home_team)||0)+1);counts.set(g.away_team,(counts.get(g.away_team)||0)+1)}return{idle:[...counts.entries()].filter(([,n])=>n===0).map(([t])=>t),multi:[...counts.entries()].filter(([,n])=>n>1).map(([t,n])=>`${t} ×${n}`)}};
 if(auth===null)return <main className="fantasy-shell"><p className="fantasy-lead">Laster fantasy-runder …</p></main>;
 if(!auth)return <main className="fantasy-shell"><section className="team-panel"><h1>Fantasy-runder</h1><p className="team-muted">Du må være logget inn for å se rundeoversikten.</p></section></main>;
 return <main className="fantasy-shell rounds-shell">
  <section className="team-builder-head"><div><p className="fantasy-kicker">STANG INN · EHL FANTASY 2026/27</p><h1>Fantasy-runder</h1><p>Kampene følger faktisk kampdato. Deadline er første kampstart i hver fantasy-runde.</p></div></section>
  <section className="team-metric-grid"><article><span>Fantasy-runder</span><strong>{rounds.length}</strong></article><article><span>Kamper</span><strong>{totalGames}</strong></article><article><span>Ferdige runder</span><strong>{finished}</strong></article><article><span>Neste runde</span><strong>{next?`R${next.round_no}`:"—"}</strong></article><article><span>Neste deadline</span><strong className="rounds-deadline-metric">{next?fmt(next.deadline_at):"—"}</strong></article></section>
  {message&&<p className="team-error">{message}</p>}
  <section className="team-panel rounds-panel"><div className="leaderboard-section-head"><div><p className="eyebrow">KALENDER</p><h2>Alle runder</h2></div><span className="team-muted">Neste runde åpnes automatisk · klikk for å åpne/lukke</span></div>
   <div className="rounds-list">{rounds.map(r=>{const rg=gameMap.get(r.id)||[],open=selected===r.id,isNext=next?.id===r.id,dist=roundDistribution(rg),first=rg[0]?.starts_at,last=rg.at(-1)?.starts_at;return <article key={r.id} className={`round-card ${isNext?"next":""}`}><button className="round-card-main" onClick={()=>setSelected(open?null:r.id)}><div className="round-number"><small>RUNDE</small><strong>{r.round_no}</strong></div><div className="round-summary"><strong>{r.name||`Fantasy-runde ${r.round_no}`}{isNext&&<em>NESTE</em>}</strong><small>Deadline {fmt(r.deadline_at)}</small></div><div className="round-stat"><small>Kamper</small><b>{rg.length}</b></div><div className="round-stat"><small>Status</small><b className={`round-status ${r.status}`}>{statusLabel(r.status)}</b></div><span className="leaderboard-chevron">{open?"▾":"▸"}</span></button>{open&&<div className="round-games"><div className="round-distribution"><div><small>KAMPVINDU</small><strong>{first?fmt(first):"Ingen kamper"}{first&&last&&first!==last?` → ${fmt(last)}`:""}</strong></div><div><small>FLERE KAMPER</small><strong>{dist.multi.length?dist.multi.join(" · "):"Ingen"}</strong></div><div><small>UTEN KAMP</small><strong>{dist.idle.length?dist.idle.join(" · "):"Ingen"}</strong></div></div>{rg.length===0?<p className="team-muted">Ingen kamper er knyttet til denne fantasy-runden.</p>:rg.map(g=><div key={g.game_id} className="round-game"><span>{fmt(g.starts_at)}</span><strong>{g.home_team}</strong><b>–</b><strong>{g.away_team}</strong></div>)}</div>}</article>})}</div>
   {rounds.length===0&&<div className="leaderboard-empty"><strong>Ingen fantasy-runder funnet.</strong><span>Rundene opprettes automatisk fra terminlisten.</span></div>}
  </section>
  <section className="team-info-grid"><article className="team-info-card"><h3>📅 Faktisk kampdato</h3><p>Flyttes en EHL-kamp, følger kampen den fantasy-runden som samsvarer med den nye kampdatoen.</p></article><article className="team-info-card"><h3>⏰ Deadline</h3><p>Hele laget fryses ved første kampstart i fantasy-runden.</p></article><article className="team-info-card"><h3>🏒 Ulikt antall kamper</h3><p>En runde kan ha for eksempel 4, 5 eller 6 kamper. Et lag kan derfor ha 0, 1 eller flere kamper i samme runde.</p></article></section>
 </main>;
}
