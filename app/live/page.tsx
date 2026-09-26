"use client";
import FantasyLivePoints from "../../components/FantasyLivePoints";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase";
import { fetchLivePoints } from "../../lib/live-client";
import { useVisibleRefresh } from "../../lib/hooks/use-visible-refresh";
import styles from "./page.module.css";

type Player={id:string;display_name:string;email:string|null};
type Match={id:number;external_id:string;live_preview?:boolean;home_team:string;away_team:string;match_time:string|null;home_score:number|null;away_score:number|null;finished:boolean;round:number|null};
type Tip={player_id:string;match_id:number;home_tip:number;away_tip:number;points:number|null};
type Standing=Player&{points:number;exact:number;correct:number;tonight:number};

const outcome=(h:number,a:number)=>h>a?"H":h<a?"A":"D";
const calcPreview=(m:Match,t?:Tip)=>{if(!t||m.home_score===null||m.away_score===null)return 0;if(t.home_tip===m.home_score&&t.away_tip===m.away_score)return 5;return outcome(t.home_tip,t.away_tip)===outcome(m.home_score,m.away_score)?3:0};
const validFinished=(m:Match)=>m.finished&&m.home_score!==null&&m.away_score!==null;
const started=(m:Match)=>m.finished||!!m.match_time&&Date.now()>=new Date(m.match_time).getTime();
const isLive=(m:Match)=>!m.finished&&Boolean(m.live_preview);
const localDate=(v:string|null)=>v?new Date(v).toLocaleDateString("sv-SE",{timeZone:"Europe/Oslo"}):"";
const formatTime=(v:string|null)=>v?new Date(v).toLocaleTimeString("no-NO",{hour:"2-digit",minute:"2-digit",timeZone:"Europe/Oslo"}):"–";
const short=(n:string)=>n.replace(/Elitehockeyligaen|Ishockeyklubb|Ishockey|Hockey|\bIL\b|\bIK\b/gi,"").replace(/\s{2,}/g," ").trim();

function buildStandings(players:Player[],matches:Match[],tips:Tip[],gameDate:string):Standing[]{
 const finished=matches.filter(validFinished),finishedMap=new Map(finished.map(m=>[m.id,m]));
 const liveTonight=matches.filter(m=>localDate(m.match_time)===gameDate&&isLive(m)&&m.home_score!==null&&m.away_score!==null);
 return players.map(p=>{
  const confirmedTips=tips.filter(t=>t.player_id===p.id&&finishedMap.has(t.match_id));
  const confirmedValues=confirmedTips.map(t=>{const m=finishedMap.get(t.match_id)!;return{tip:t,match:m,points:t.points===null?calcPreview(m,t):Number(t.points)}});
  const confirmedPoints=confirmedValues.reduce((s,x)=>s+x.points,0);
  const exact=confirmedValues.filter(x=>x.points===5).length;
  const correct=confirmedValues.filter(x=>x.points>0).length;
  const confirmedTonight=confirmedValues.filter(x=>localDate(x.match.match_time)===gameDate).reduce((s,x)=>s+x.points,0);
  const livePreview=liveTonight.reduce((sum,m)=>sum+calcPreview(m,tips.find(t=>t.player_id===p.id&&t.match_id===m.id)),0);
  return{...p,points:confirmedPoints+livePreview,exact,correct,tonight:confirmedTonight+livePreview};
 }).sort((a,b)=>b.points-a.points||b.exact-a.exact||b.correct-a.correct||a.display_name.localeCompare(b.display_name,"no"));
}

export default function LivePage(){
 const[players,setPlayers]=useState<Player[]>([]),[tips,setTips]=useState<Tip[]>([]),[matches,setMatches]=useState<Match[]>([]),[standings,setStandings]=useState<Standing[]>([]);
 const[movement,setMovement]=useState<Record<string,number>>({}),[loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[lastUpdated,setLastUpdated]=useState<Date|null>(null);
 const prev=useRef<Standing[]>([]);
 const [liveError,setLiveError]=useState("");
 const gameDate=useMemo(()=>{const today=new Date().toLocaleDateString("sv-SE",{timeZone:"Europe/Oslo"});if(matches.some(m=>localDate(m.match_time)===today))return today;const dates=[...new Set(matches.map(m=>localDate(m.match_time)).filter(Boolean))].sort();return dates.find(d=>matches.some(m=>localDate(m.match_time)===d&&!m.finished))||dates.at(-1)||today},[matches]);
 const load=useCallback(async(silent=false)=>{const s=getSupabaseBrowserClient();if(!s)return;if(silent)setRefreshing(true);const[p,m,t]=await Promise.all([s.from("players").select("id,display_name,email").order("created_at"),s.from("matches").select("id,external_id,home_team,away_team,match_time,home_score,away_score,finished,round").eq("cancelled", false).order("match_time"),s.from("tips").select("player_id,match_id,home_tip,away_tip,points")]);const ps=(p.data||[])as Player[],ms=(m.data||[])as Match[],ts=(t.data||[])as Tip[];try{const live=await fetchLivePoints();const stale=Date.now()-new Date(live.checkedAt).getTime()>120000;setLiveError(stale?"Live-kilden er forsinket. Viser siste tilgjengelige tall.":live.matches.some(x=>x.homeScore===null)?"Venter på scoredata fra HockeyLive for enkelte kamper.":"");for(const match of ms){if(match.finished)continue;const overlay=live.matches.find(x=>x.externalId===match.external_id);if(overlay){match.home_score=overlay.homeScore;match.away_score=overlay.awayScore;match.live_preview=overlay.homeScore!==null&&overlay.awayScore!==null}}}catch(e){setLiveError(e instanceof Error?e.message:"Live-data utilgjengelig")};const today=new Date().toLocaleDateString("sv-SE",{timeZone:"Europe/Oslo"});const dates=[...new Set(ms.map(x=>localDate(x.match_time)).filter(Boolean))].sort();const gd=ms.some(x=>localDate(x.match_time)===today)?today:(dates.find(d=>ms.some(x=>localDate(x.match_time)===d&&!x.finished))||dates.at(-1)||today);const next=buildStandings(ps,ms,ts,gd);if(prev.current.length){const old=new Map(prev.current.map((x,i)=>[x.id,i+1]));const mv:Record<string,number>={};next.forEach((x,i)=>mv[x.id]=(old.get(x.id)||i+1)-(i+1));setMovement(mv)}prev.current=next;setPlayers(ps);setMatches(ms);setTips(ts);setStandings(next);setLastUpdated(new Date());setLoading(false);setRefreshing(false)},[]);
 useEffect(()=>{void load()},[load]);
 useVisibleRefresh(()=>load(true));
 const night=useMemo(()=>matches.filter(m=>localDate(m.match_time)===gameDate),[matches,gameDate]);
 const liveMatches=night.filter(isLive),finished=night.filter(validFinished),waiting=night.filter(m=>!validFinished(m)&&!isLive(m));
 const dateLabel=new Date(`${gameDate}T12:00:00`).toLocaleDateString("no-NO",{weekday:"long",day:"numeric",month:"long"});
 const best=[...standings].sort((a,b)=>b.tonight-a.tonight)[0];
 if(loading)return <main className={styles.shell}><p className={styles.muted}>Laster live-senter …</p></main>;
 return <main className={styles.shell}>
  <header className={styles.header}><a className={styles.back} href="/">← Stang Inn</a><div className={styles.liveBadge}><span/> {liveMatches.length?`${liveMatches.length} LIVE`:"LIVE-SENTER"}</div></header>
  <section className={styles.hero}><div><p className={styles.eyebrow}>Kampkveld · {dateLabel}</p><h1>Live-senter</h1><p className={styles.muted}>Beregnet stilling inkluderer foreløpige live-poeng. Endelige poeng lagres først når kampen er ferdigscoret.</p></div><button className={styles.refresh} onClick={()=>load(true)} disabled={refreshing}>{refreshing?"Oppdaterer …":"↻ Oppdater nå"}</button></section>
  {liveError&&<p role="status" className={styles.note}>{liveError}</p>}
  <section className={styles.summary}><article><span>Live nå</span><strong>{liveMatches.length}</strong><small>{finished.length} ferdige · {waiting.length} venter</small></article><article><span>Leder</span><strong>{standings[0]?.display_name||"–"}</strong><small>{standings[0]?.points??0} beregnede poeng</small></article><article><span>Kveldens beste</span><strong>{best?.display_name||"–"}</strong><small>+{best?.tonight??0} beregnede poeng</small></article></section>
  <section className={styles.liveGames}><div className={styles.panelHeading}><div><p className={styles.eyebrow}>Kamper</p><h2>Kampene akkurat nå</h2></div><span className={styles.updated}>{lastUpdated?`Oppdatert ${lastUpdated.toLocaleTimeString("no-NO",{hour:"2-digit",minute:"2-digit"})}`:""}</span></div>{night.length===0&&<article className={styles.panel}><p className={styles.muted}>Ingen kamper på denne kampdatoen.</p></article>}{night.map(m=>{const mt=tips.filter(t=>t.match_id===m.id);const impact=players.map(p=>({p,t:mt.find(x=>x.player_id===p.id)})).filter(x=>x.t).map(x=>({...x,pts:calcPreview(m,x.t)})).sort((a,b)=>b.pts-a.pts||a.p.display_name.localeCompare(b.p.display_name,"no"));return <article className={`${styles.liveGameCard} ${isLive(m)?styles.liveGameActive:""}`} key={m.id}><div className={styles.gameTop}><span>{validFinished(m)?"🏁 FERDIG":isLive(m)?"🟢 LIVE":started(m)?"🟡 STARTET":"🔵 KOMMENDE"}</span><small>{formatTime(m.match_time)}{m.round?` · Runde ${m.round}`:""}</small></div><div className={styles.gameScore}><div><small>HJEMME</small><strong>{short(m.home_team)}</strong></div><b>{m.home_score!==null&&m.away_score!==null?`${m.home_score}–${m.away_score}`:"VS"}</b><div><small>BORTE</small><strong>{short(m.away_team)}</strong></div></div><div className={styles.impact}><strong>{validFinished(m)?"Bekreftede poeng":"Foreløpig påvirkning"}</strong>{!started(m)?<p className={styles.muted}>Tipsene åpnes ved kampstart.</p>:m.home_score===null||m.away_score===null?<p className={styles.muted}>Kampen er startet, men HockeyLive har ikke levert scoredata ennå.</p>:impact.slice(0,5).map(({p,t,pts})=><div className={styles.impactRow} key={p.id}><span>{p.display_name} · {t?.home_tip}–{t?.away_tip}</span><b className={pts===5?styles.five:pts===3?styles.three:styles.zero}>+{pts}</b></div>)}</div><a className={styles.gameLink} href={`/match/${m.id}`}>Åpne kampside →</a></article>})}</section>
  <section className={styles.grid}><article className={styles.panel}><div className={styles.panelHeading}><div><p className={styles.eyebrow}>Sammenlagt</p><h2>Beregnet stilling</h2></div></div><div className={styles.tableHead}><span>#</span><span>Spiller</span><span>I kveld</span><span>Poeng</span></div>{standings.map((p,i)=>{const mv=movement[p.id]||0;return <div className={styles.row} key={p.id}><span className={styles.rank}>{i<3?["🥇","🥈","🥉"][i]:i+1}</span><span className={styles.player}><b>{p.display_name}</b><small>{p.exact} eksakte · {p.correct} riktige bekreftet</small></span><span className={styles.tonight}>+{p.tonight}</span><span className={styles.total}>{p.points}</span><span className={`${styles.move} ${mv>0?styles.up:mv<0?styles.down:""}`}>{mv>0?`▲ ${mv}`:mv<0?`▼ ${Math.abs(mv)}`:"—"}</span></div>})}</article><article className={styles.panel}><div className={styles.panelHeading}><div><p className={styles.eyebrow}>Status</p><h2>Kampkvelden</h2></div></div><div className={styles.matchList}>{night.map(m=><a href={`/match/${m.id}`} className={styles.match} key={m.id}><div><small>{formatTime(m.match_time)}{m.round?` · Runde ${m.round}`:""}</small><b>{short(m.home_team)} – {short(m.away_team)}</b></div><strong>{m.home_score!==null&&m.away_score!==null?`${m.home_score}–${m.away_score}`:"–"}</strong></a>)}</div></article></section>
  <FantasyLivePoints/>
  <p className={styles.note}>Målscorere, utvisninger og periodetid vises først når HockeyLive/API-et faktisk leverer disse feltene.</p>
 </main>
}
