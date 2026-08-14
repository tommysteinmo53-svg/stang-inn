"use client";

import {useEffect,useState} from "react";
import {useParams} from "next/navigation";
import {getSupabaseBrowserClient} from "../../../../lib/supabase";
import "../../fantasy.css";

const SEASON="2026/27";

type Fixture={gameId:string;startsAt:string;homeTeam:string;awayTeam:string;opponent:string;home:boolean;roundNo:number|null;status:string};
type History={gameId:string;startsAt:string;homeTeam:string;awayTeam:string;roundNo:number|null;fantasyPoints:number;breakdown:Record<string,unknown>};
type Profile={
 player:{id:string;name:string;team:string;position:string;active:boolean;onCurrentRoster:boolean;availableForPurchase:boolean;price:number|null};
 fantasy:{total:number;average:number;gamesScored:number};
 form:{games:number;points:number;average:number};
 stats:{games:number;goals:number;assists:number;points:number;shots:number;plusMinus:number;pim:number;powerplayGoals:number;shorthandedGoals:number;gameWinningGoals:number;saves:number;goalsAgainst:number;wins:number;shutouts:number;minutesPlayed:number};
 ownership:{percent:number;ownerTeams:number;totalTeams:number};
 upcoming:Fixture[];
 history:History[];
};

const n=(v:unknown)=>Number(v||0);
const posLabel=(p:string)=>p==="G"?"Keeper":p==="D"?"Back":"Forward";
const date=(v:string)=>new Date(v).toLocaleString("nb-NO",{weekday:"short",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
const shortTeam=(name:string)=>{
 const v=(name||"").toLowerCase();
 if(v.includes("frisk asker"))return "Frisk Asker";
 if(v.includes("lillehammer"))return "Lillehammer";
 if(v.includes("lørenskog"))return "Lørenskog";
 if(v.includes("narvik"))return "Narvik";
 if(v.includes("nidaros"))return "Nidaros";
 if(v.includes("ringerike"))return "Ringerike";
 if(v.includes("sparta"))return "Sparta";
 if(v.includes("stavanger"))return "Stavanger Oilers";
 if(v.includes("stjernen"))return "Stjernen";
 if(v.includes("storhamar"))return "Storhamar";
 if(v.includes("vålerenga"))return "Vålerenga";
 return name.replace(/\s*-\s*MEN\s*1/gi,"").trim();
};

export default function FantasyPlayerProfilePage(){
 const params=useParams<{id:string}>();
 const id=params?.id;
 const[data,setData]=useState<Profile|null>(null);
 const[busy,setBusy]=useState(true);
 const[message,setMessage]=useState("");

 useEffect(()=>{(async()=>{try{
  if(!id)return;
  const sb=getSupabaseBrowserClient();if(!sb)throw new Error("Supabase er ikke tilgjengelig");
  const{data:session}=await sb.auth.getSession();if(!session.session)throw new Error("Du må være logget inn");
  const{data,error}=await sb.rpc("get_fantasy_player_profile_v1",{p_player_id:id,p_season:SEASON});if(error)throw error;
  const d=data as any;
  setData({...d,fantasy:{total:n(d?.fantasy?.total),average:n(d?.fantasy?.average),gamesScored:n(d?.fantasy?.gamesScored)},form:{games:n(d?.form?.games),points:n(d?.form?.points),average:n(d?.form?.average)},ownership:{percent:n(d?.ownership?.percent),ownerTeams:n(d?.ownership?.ownerTeams),totalTeams:n(d?.ownership?.totalTeams)},stats:Object.fromEntries(Object.entries(d?.stats||{}).map(([k,v])=>[k,n(v)])),upcoming:d?.upcoming||[],history:(d?.history||[]).map((h:any)=>({...h,fantasyPoints:n(h.fantasyPoints)}))} as Profile);
 }catch(e:any){setMessage(`Kunne ikke hente spillerprofil: ${e.message||e}`)}finally{setBusy(false)}})()},[id]);

 if(busy)return <main className="fantasy-shell"><p className="fantasy-lead">Henter spillerprofil …</p></main>;
 if(message||!data)return <main className="fantasy-shell"><section className="team-builder-head"><div><p className="fantasy-kicker">STANG INN · FANTASY 2026/27</p><h1>Spillerprofil</h1></div></section><p className="team-message">{message||"Spilleren ble ikke funnet."}</p></main>;

 const{player,fantasy,form,stats,ownership,upcoming,history}=data;
 const isGoalie=player.position==="G";
 return <main className="fantasy-shell">
  <section className="team-builder-head"><div><p className="fantasy-kicker">STANG INN · SPILLERPROFIL</p><h1>{player.name}</h1><p>{player.team} · {posLabel(player.position)}{!player.onCurrentRoster?" · Ikke på aktiv EHL-roster":""}</p></div><a className="team-save" style={{textDecoration:"none",width:"auto",alignSelf:"center"}} href="/fantasy/team">← Til lagbygger</a></section>

  <section className="team-metric-grid">
   <article><span>Fast pris</span><strong>{player.price==null?"–":`${Number(player.price).toFixed(1)}m`}</strong><small>låst 2026/27</small></article>
   <article><span>Fantasy-poeng</span><strong>{fantasy.total.toFixed(1)}</strong><small>{fantasy.average.toFixed(2)} per kamp</small></article>
   <article><span>Form</span><strong>{form.points.toFixed(1)}</strong><small>siste {form.games} · {form.average.toFixed(2)} i snitt</small></article>
   <article><span>Eierandel</span><strong>{ownership.percent.toFixed(1)}%</strong><small>{ownership.ownerTeams}/{ownership.totalTeams} lag</small></article>
   <article><span>Kamper</span><strong>{stats.games}</strong><small>{fantasy.gamesScored} med Fantasy-poeng</small></article>
  </section>

  <section className="team-builder-grid" style={{alignItems:"start"}}>
   <div className="team-panel">
    <p className="eyebrow">SESONGSTATISTIKK</p><h2>2026/27</h2>
    <div className="team-metric-grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))"}}>
     {!isGoalie&&<><article><span>Mål</span><strong>{stats.goals}</strong></article><article><span>Assist</span><strong>{stats.assists}</strong></article><article><span>Poeng</span><strong>{stats.points}</strong></article><article><span>Skudd</span><strong>{stats.shots}</strong></article><article><span>+/−</span><strong>{stats.plusMinus}</strong></article><article><span>PIM</span><strong>{stats.pim}</strong></article><article><span>PP-mål</span><strong>{stats.powerplayGoals}</strong></article><article><span>SH-mål</span><strong>{stats.shorthandedGoals}</strong></article><article><span>GWG</span><strong>{stats.gameWinningGoals}</strong></article></>}
     {isGoalie&&<><article><span>Seire</span><strong>{stats.wins}</strong></article><article><span>Shutouts</span><strong>{stats.shutouts}</strong></article><article><span>Redninger</span><strong>{stats.saves}</strong></article><article><span>Baklengs</span><strong>{stats.goalsAgainst}</strong></article><article><span>Minutter</span><strong>{stats.minutesPlayed.toFixed(0)}</strong></article></>}
    </div>
   </div>

   <aside className="team-panel"><p className="eyebrow">KOMMENDE</p><h2>Neste kamper</h2>
    <div className="team-pool-list">{upcoming.map(g=><div className="team-player-row" key={g.gameId} style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",gap:12,alignItems:"center"}}><div className="team-player-main" style={{minWidth:0}}><strong style={{whiteSpace:"normal",overflow:"visible",textOverflow:"clip"}}>{shortTeam(g.opponent)}</strong><small style={{whiteSpace:"normal",lineHeight:1.45}}>{date(g.startsAt)}{g.roundNo?` · Runde ${g.roundNo}`:""}</small></div><span className="team-price" style={{minWidth:42,textAlign:"center"}}>{g.home?"H":"B"}</span></div>)}{!upcoming.length&&<p className="team-muted">Ingen kommende kamper registrert.</p>}</div>
   </aside>
  </section>

  <section className="team-panel" style={{marginTop:24}}><p className="eyebrow">FANTASY-HISTORIKK</p><h2>Siste kamper</h2>
   <div className="team-pool-list">{history.map(h=><div key={h.gameId} className="team-player-row" style={{gridTemplateColumns:"1fr auto"}}><div className="team-player-main"><strong>{shortTeam(h.homeTeam)} – {shortTeam(h.awayTeam)}</strong><small>{date(h.startsAt)}{h.roundNo?` · Runde ${h.roundNo}`:""}</small></div><span className="team-price">{h.fantasyPoints.toFixed(1)} p</span></div>)}{!history.length&&<p className="team-muted">Ingen Fantasy-poeng registrert ennå.</p>}</div>
  </section>
 </main>;
}
