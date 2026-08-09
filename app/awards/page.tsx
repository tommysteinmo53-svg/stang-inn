"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase";

type Player={id:string;display_name:string};
type Match={id:number;home_team:string;away_team:string;home_score:number|null;away_score:number|null;finished:boolean;round:number|null;match_time:string|null};
type Tip={player_id:string;match_id:number;home_tip:number;away_tip:number;points:number|null};
type Award={icon:string;title:string;player:Player|null;value:string;detail:string};

const isFinal=(m:Match)=>m.finished&&m.home_score!==null&&m.away_score!==null;
const outcome=(h:number,a:number)=>h>a?"H":h<a?"A":"D";
const resolvedPoints=(m:Match,t:Tip)=>{
 if(t.points!==null)return Number(t.points);
 if(m.home_score===null||m.away_score===null)return 0;
 if(t.home_tip===m.home_score&&t.away_tip===m.away_score)return 5;
 return outcome(t.home_tip,t.away_tip)===outcome(m.home_score,m.away_score)?3:0;
};

export default function AwardsPage(){
 const [players,setPlayers]=useState<Player[]>([]),[matches,setMatches]=useState<Match[]>([]),[tips,setTips]=useState<Tip[]>([]),[loading,setLoading]=useState(true);
 useEffect(()=>{(async()=>{const s=getSupabaseBrowserClient();if(!s){setLoading(false);return}const[p,m,t]=await Promise.all([s.from("players").select("id,display_name"),s.from("matches").select("id,home_team,away_team,home_score,away_score,finished,round,match_time").order("match_time"),s.from("tips").select("player_id,match_id,home_tip,away_tip,points")]);setPlayers((p.data||[])as Player[]);setMatches((m.data||[])as Match[]);setTips((t.data||[])as Tip[]);setLoading(false)})()},[]);
 const data=useMemo(()=>{
  const finished=matches.filter(isFinal),matchMap=new Map(finished.map(m=>[m.id,m])),ids=new Set(finished.map(m=>m.id));
  const scored=tips.filter(t=>ids.has(t.match_id));
  const pointsFor=(t:Tip)=>{const m=matchMap.get(t.match_id);return m?resolvedPoints(m,t):0};
  const byPlayer=players.map(p=>{const pt=scored.filter(t=>t.player_id===p.id),values=pt.map(t=>pointsFor(t));return{p,points:values.reduce((s,n)=>s+n,0),exact:values.filter(n=>n===5).length,correct:values.filter(n=>n===3).length,tipped:pt.length}});
  const sniper=scored.length?[...byPlayer].sort((a,b)=>b.exact-a.exact||b.points-a.points||b.correct-a.correct||a.p.display_name.localeCompare(b.p.display_name,"no"))[0]:null;

  let streak:{p:Player;n:number}|null=null;
  if(scored.length){for(const p of players){let cur=0,best=0;for(const m of [...finished].sort((a,b)=>(a.match_time||"").localeCompare(b.match_time||""))){const t=scored.find(x=>x.player_id===p.id&&x.match_id===m.id);if(t&&resolvedPoints(m,t)>0){cur++;best=Math.max(best,cur)}else cur=0}if(best>0&&(!streak||best>streak.n))streak={p,n:best}}}

  const roundNumbers=[...new Set(matches.map(m=>m.round).filter((r):r is number=>r!==null))].sort((a,b)=>a-b);
  const completedRounds=roundNumbers.filter(r=>{const rm=matches.filter(m=>m.round===r);return rm.length>0&&rm.every(isFinal)});
  const latestRound=completedRounds.at(-1);
  let roundWinner:{p:Player;points:number;exact:number;correct:number}|null=null;
  if(latestRound!==undefined){const rids=new Set(finished.filter(m=>m.round===latestRound).map(m=>m.id));const rows=players.map(p=>{const pt=scored.filter(t=>t.player_id===p.id&&rids.has(t.match_id)),values=pt.map(t=>pointsFor(t));return{p,points:values.reduce((s,n)=>s+n,0),exact:values.filter(n=>n===5).length,correct:values.filter(n=>n===3).length}}).sort((a,b)=>b.points-a.points||b.exact-a.exact||b.correct-a.correct||a.p.display_name.localeCompare(b.p.display_name,"no"));roundWinner=rows[0]||null}

  let miss:{p:Player;distance:number;match:Match;tip:Tip}|null=null;for(const t of scored){const m=matchMap.get(t.match_id),p=players.find(x=>x.id===t.player_id);if(!m||!p)continue;const d=Math.abs(t.home_tip-m.home_score!)+Math.abs(t.away_tip-m.away_score!);if(!miss||d>miss.distance)miss={p,distance:d,match:m,tip:t}}
  const awards:Award[]=[{icon:"🏆",title:"Rundevinner",player:roundWinner?.p||null,value:roundWinner?`${roundWinner.points} poeng`:"–",detail:latestRound!==undefined?`Runde ${latestRound}`:"Ingen ferdigspilte runder"},{icon:"🎯",title:"Sniper",player:sniper?.p||null,value:sniper?`${sniper.exact} eksakte`:"–",detail:"Flest 5-poengere denne sesongen"},{icon:"🔥",title:"Beste streak",player:streak?.p||null,value:streak?`${streak.n} på rad`:"–",detail:"Lengste rekke med poenggivende tips"},{icon:"💥",title:"Sesongens bom",player:miss?.p||null,value:miss?`${miss.tip.home_tip}–${miss.tip.away_tip}`:"–",detail:miss?`${miss.match.home_team}–${miss.match.away_team} endte ${miss.match.home_score}–${miss.match.away_score}`:"Ingen ferdige kamper"}];return awards;
 },[players,matches,tips]);
 if(loading)return <main className="appShell"><p className="muted">Laster awards …</p></main>;
 return <main className="appShell"><header className="topbar"><a href="/" className="brand brandButton" style={{textDecoration:"none"}}><div className="brandMark">🏒</div><div><p className="eyebrow">Hall of fame</p><h1>Awards</h1></div></a></header><section className="pageStack" style={{marginTop:22}}><article className="heroCard"><div><p className="eyebrow">Prestasjoner</p><h2>Hvem utmerker seg?</h2><p className="muted">Samme 5/3/0-regler som leaderboard, spillerprofiler og live-visning.</p></div><div className="countdown"><strong>🏅</strong><span>Stang Inn</span></div></article><section className="awardsGrid">{data.map(a=><article className="awardCard" key={a.title}><div className="awardIcon">{a.icon}</div><p className="eyebrow">{a.title}</p><h2>{a.player?.display_name||"Ikke kåret"}</h2><strong>{a.value}</strong><p className="muted">{a.detail}</p>{a.player&&<a href={`/player/${a.player.id}`}>Se spillerprofil →</a>}</article>)}</section><article className="panel"><div className="panelHeading"><div><p className="eyebrow">Sesongen</p><h3>Kåringer aktiveres av faktiske resultater</h3></div></div><p className="muted">Ingen spiller kåres til Sniper eller Beste streak før det finnes ferdigspilte tips å måle på.</p></article></section></main>
}
