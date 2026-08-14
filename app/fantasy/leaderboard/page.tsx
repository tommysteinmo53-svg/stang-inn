"use client";

import {useEffect,useMemo,useState} from "react";
import {getSupabaseBrowserClient} from "../../../lib/supabase";
import "../fantasy.css";

type Standing={standings_position:number;team_id:string;team_name:string;total_points:number;rounds_scored:number;round_wins:number;best_round_points:number;average_round_points:number;last_round_no:number|null;last_round_points:number|null};
type HistoryRow={round_id:string;round_no:number;deadline_at:string;round_points:number;round_position:number};
type Monthly={month_key:string;month_start:string;standings_position:number;team_id:string;team_name:string;monthly_points:number;rounds_scored:number};
type Achievement={team_id:string;current_streak:number;longest_streak:number;expert_title:string;expert_icon:string};
const SEASON="2026/27";
const pts=(v:unknown)=>Number(v||0).toFixed(1).replace(".0","");
const monthLabel=(v:string)=>new Intl.DateTimeFormat("nb-NO",{month:"long",year:"numeric",timeZone:"Europe/Oslo"}).format(new Date(`${v}T12:00:00Z`));

export default function FantasyLeaderboard(){
 const[auth,setAuth]=useState<boolean|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const[rows,setRows]=useState<Standing[]>([]),[monthly,setMonthly]=useState<Monthly[]>([]),[achievements,setAchievements]=useState<Record<string,Achievement>>({});
 const[selected,setSelected]=useState<string|null>(null),[history,setHistory]=useState<Record<string,HistoryRow[]>>({});
 useEffect(()=>{(async()=>{const sb=getSupabaseBrowserClient();if(!sb){setAuth(false);return}const{data}=await sb.auth.getSession();setAuth(Boolean(data.session))})()},[]);
 async function load(){setBusy(true);setMessage("");try{const sb=getSupabaseBrowserClient();if(!sb)throw new Error("Supabase er ikke tilgjengelig");const[{data:r,error},{data:m,error:me},{data:a,error:ae}]=await Promise.all([sb.rpc("get_fantasy_season_leaderboard",{p_season:SEASON}),sb.rpc("get_fantasy_monthly_leaderboard",{p_season:SEASON}),sb.rpc("get_fantasy_team_achievements",{p_season:SEASON})]);if(error)throw error;if(me)throw me;if(ae)throw ae;setRows((r||[]) as Standing[]);setMonthly((m||[]) as Monthly[]);const map:Record<string,Achievement>={};for(const x of (a||[]) as Achievement[])map[x.team_id]=x;setAchievements(map)}catch(e:any){setMessage(`Kunne ikke hente leaderboard: ${e?.message||e}`)}finally{setBusy(false)}}
 useEffect(()=>{if(auth)load()},[auth]);
 async function toggle(teamId:string){if(selected===teamId){setSelected(null);return}setSelected(teamId);if(history[teamId])return;const sb=getSupabaseBrowserClient();if(!sb)return;const{data,error}=await sb.rpc("get_fantasy_team_season_history",{p_team_id:teamId,p_season:SEASON});if(error){setMessage(`Kunne ikke hente rundehistorikk: ${error.message}`);return}setHistory(v=>({...v,[teamId]:(data||[]) as HistoryRow[]}))}
 const winners=monthly.filter(x=>x.standings_position===1);
 const leader=rows[0],mostWins=useMemo(()=>rows.length?Math.max(...rows.map(r=>r.round_wins)):0,[rows]);
 if(auth===null)return <main className="fantasy-shell"><p className="fantasy-lead">Laster leaderboard …</p></main>;
 if(!auth)return <main className="fantasy-shell"><section className="team-panel"><h1>Leaderboard</h1><p className="team-muted">Du må være logget inn for å se tabellen.</p></section></main>;
 return <main className="fantasy-shell leaderboard-shell">
  <section className="team-builder-head"><div><p className="fantasy-kicker">STANG INN · EHL FANTASY 2026/27</p><h1>Leaderboard</h1><p>Sesongtabellen basert på lagrede rundepoeng.</p></div><button className="leaderboard-refresh" onClick={load} disabled={busy}>{busy?"Oppdaterer …":"Oppdater"}</button></section>
  <section className="team-metric-grid"><article><span>Fantasy-lag</span><strong>{rows.length}</strong></article><article><span>Leder</span><strong>{leader?.team_name||"—"}</strong><small>{leader?`${pts(leader.total_points)} poeng`:"Ingen scorede runder"}</small></article><article><span>Flest rundeseire</span><strong>{mostWins}</strong></article><article><span>Scorede runder</span><strong>{leader?.rounds_scored||0}</strong></article><article><span>Siste runde</span><strong>{leader?.last_round_no?`R${leader.last_round_no}`:"—"}</strong></article></section>
  {message&&<p className="team-error">{message}</p>}
  {winners.length>0&&<section className="team-panel leaderboard-months"><div className="leaderboard-section-head"><div><p className="eyebrow">MÅNEDSVINNERE</p><h2>🏆 Månedens beste</h2></div></div><div className="leaderboard-winners">{winners.map(w=><article key={`${w.month_key}-${w.team_id}`}><small>{monthLabel(w.month_start)}</small><strong>{w.team_name}</strong><span>{pts(w.monthly_points)} p · {w.rounds_scored} runder</span></article>)}</div></section>}
  <section className="team-panel leaderboard-table-panel"><div className="leaderboard-section-head"><div><p className="eyebrow">SESONGTABELL</p><h2>Stillingen</h2></div><span className="team-muted">Klikk på et lag for rundehistorikk</span></div>
   {rows.length===0?<div className="leaderboard-empty"><strong>Ingen scorede fantasy-runder ennå.</strong><span>Tabellen fylles automatisk når første fantasy-runde er ferdigscoret.</span></div>:<div className="leaderboard-list">{rows.map(r=>{const a=achievements[r.team_id];return <div className={`leaderboard-entry ${r.standings_position<=3?"podium":""}`} key={r.team_id}><button className="leaderboard-row" onClick={()=>toggle(r.team_id)}><span className="leaderboard-rank">{r.standings_position===1?"🥇":r.standings_position===2?"🥈":r.standings_position===3?"🥉":`${r.standings_position}.`}</span><span className="leaderboard-team"><strong>{r.team_name}</strong><small>{a?`${a.expert_icon} ${a.expert_title}`:"🌱 Rookie"} · 🔥 {a?.current_streak??0}</small></span><span><small>Poeng</small><b>{pts(r.total_points)}</b></span><span><small>Seire</small><b>{r.round_wins}</b></span><span><small>Snitt</small><b>{pts(r.average_round_points)}</b></span><span><small>Beste</small><b>{pts(r.best_round_points)}</b></span><span><small>Siste</small><b>{r.last_round_no?`${pts(r.last_round_points)} p`:"—"}</b></span><span className="leaderboard-chevron">{selected===r.team_id?"▾":"▸"}</span></button>{selected===r.team_id&&<div className="leaderboard-history"><div className="leaderboard-history-title"><strong>{a?.expert_icon||"🌱"} {a?.expert_title||"Rookie"}</strong><span>Streak {a?.current_streak??0} · rekord {a?.longest_streak??0}</span></div>{(history[r.team_id]||[]).length===0?<p className="team-muted">Ingen scorede runder ennå.</p>:<div className="leaderboard-history-grid">{history[r.team_id].map(h=><article key={h.round_id}><span>Runde {h.round_no}</span><strong>{pts(h.round_points)} p</strong><small>{h.round_position===1?"🏆 ":""}{h.round_position}. plass</small></article>)}</div>}</div>}</div>})}</div>}
  </section>
 </main>
}
