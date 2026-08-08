"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase";

type Player={id:string;display_name:string};
type Match={id:number;home_team:string;away_team:string;home_score:number|null;away_score:number|null;finished:boolean;round:number|null;match_time:string|null};
type Tip={player_id:string;match_id:number;home_tip:number;away_tip:number;points:number|null};
type Award={icon:string;title:string;player:Player|null;value:string;detail:string};

export default function AwardsPage(){
 const [players,setPlayers]=useState<Player[]>([]),[matches,setMatches]=useState<Match[]>([]),[tips,setTips]=useState<Tip[]>([]),[loading,setLoading]=useState(true);
 useEffect(()=>{(async()=>{const s=getSupabaseBrowserClient();if(!s){setLoading(false);return}const[p,m,t]=await Promise.all([s.from("players").select("id,display_name"),s.from("matches").select("id,home_team,away_team,home_score,away_score,finished,round,match_time").order("match_time"),s.from("tips").select("player_id,match_id,home_tip,away_tip,points")]);setPlayers((p.data||[])as Player[]);setMatches((m.data||[])as Match[]);setTips((t.data||[])as Tip[]);setLoading(false)})()},[]);
 const data=useMemo(()=>{
  const finished=matches.filter(m=>m.finished&&m.home_score!==null&&m.away_score!==null),ids=new Set(finished.map(m=>m.id));
  const scored=tips.filter(t=>ids.has(t.match_id));
  const byPlayer=players.map(p=>{const pt=scored.filter(t=>t.player_id===p.id);return{p,points:pt.reduce((s,t)=>s+Number(t.points||0),0),exact:pt.filter(t=>Number(t.points||0)===5).length}});
  const sniper=[...byPlayer].sort((a,b)=>b.exact-a.exact||b.points-a.points)[0];
  let streak:{p:Player;n:number}|null=null;
  for(const p of players){let cur=0,best=0;const ordered=finished.map(m=>scored.find(t=>t.player_id===p.id&&t.match_id===m.id)).filter(Boolean) as Tip[];for(const t of ordered){if(Number(t.points||0)>0){cur++;best=Math.max(best,cur)}else cur=0}if(!streak||best>streak.n)streak={p,n:best}}
  const rounds=[...new Set(finished.map(m=>m.round).filter((r):r is number=>r!==null))].sort((a,b)=>b-a);const latestRound=rounds[0];let roundWinner:{p:Player;points:number}|null=null;if(latestRound!==undefined){const rids=new Set(finished.filter(m=>m.round===latestRound).map(m=>m.id));for(const p of players){const n=scored.filter(t=>t.player_id===p.id&&rids.has(t.match_id)).reduce((s,t)=>s+Number(t.points||0),0);if(!roundWinner||n>roundWinner.points)roundWinner={p,points:n}}}
  let miss:{p:Player;distance:number;match:Match;tip:Tip}|null=null;for(const t of scored){const m=finished.find(x=>x.id===t.match_id),p=players.find(x=>x.id===t.player_id);if(!m||!p)continue;const d=Math.abs(t.home_tip-m.home_score!)+Math.abs(t.away_tip-m.away_score!);if(!miss||d>miss.distance)miss={p,distance:d,match:m,tip:t}}
  const awards:Award[]=[{icon:"🏆",title:"Rundevinner",player:roundWinner?.p||null,value:roundWinner?`${roundWinner.points} poeng`:"–",detail:latestRound?`Runde ${latestRound}`:"Ingen ferdige runder"},{icon:"🎯",title:"Sniper",player:sniper?.p||null,value:sniper?`${sniper.exact} eksakte`:"–",detail:"Flest 5-poengere denne sesongen"},{icon:"🔥",title:"Streak",player:streak?.p||null,value:streak?`${streak.n} på rad`:"–",detail:"Lengste rekke med poenggivende tips"},{icon:"💥",title:"Ukens bom",player:miss?.p||null,value:miss?`${miss.tip.home_tip}–${miss.tip.away_tip}`:"–",detail:miss?`${miss.match.home_team}–${miss.match.away_team} endte ${miss.match.home_score}–${miss.match.away_score}`:"Ingen ferdige kamper"}];return awards;
 },[players,matches,tips]);
 if(loading)return <main className="appShell"><p className="muted">Laster awards …</p></main>;
 return <main className="appShell"><header className="topbar"><a href="/" className="brand brandButton" style={{textDecoration:"none"}}><div className="brandMark">🏒</div><div><p className="eyebrow">Hall of fame</p><h1>Awards</h1></div></a></header><section className="pageStack" style={{marginTop:22}}><article className="heroCard"><div><p className="eyebrow">Prestasjoner</p><h2>Hvem utmerker seg?</h2><p className="muted">Oppdateres automatisk når kampresultater og poeng kommer inn.</p></div><div className="countdown"><strong>🏅</strong><span>Stang Inn</span></div></article><section className="awardsGrid">{data.map(a=><article className="awardCard" key={a.title}><div className="awardIcon">{a.icon}</div><p className="eyebrow">{a.title}</p><h2>{a.player?.display_name||"Ikke kåret"}</h2><strong>{a.value}</strong><p className="muted">{a.detail}</p>{a.player&&<a href={`/player/${a.player.id}`}>Se spillerprofil →</a>}</article>)}</section><article className="panel"><div className="panelHeading"><div><p className="eyebrow">Neste steg</p><h3>Flere kåringer</h3></div></div><p className="muted">Månedsvinner, Klatreren og Kald periode kan legges til når sesongen har nok historikk til at kåringene blir meningsfulle.</p></article></section></main>
}
