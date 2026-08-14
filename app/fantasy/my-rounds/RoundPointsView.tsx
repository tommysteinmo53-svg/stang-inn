"use client";

import {useMemo,useState} from "react";

export type RoundDetail={round_id:string;round_no:number;round_name:string|null;deadline_at:string;team_round_points_id:string;team_id:string;team_name:string;base_points:number;captain_bonus:number;vice_captain_bonus:number;round_points:number;calculated_at:string;player_id:string;player_name:string;player_position:string;player_team:string;is_captain:boolean;is_vice_captain:boolean;played:boolean;games_played:number;raw_points:number;multiplier:number;bonus_points:number;player_total_points:number};
type RoundSummary={round_id:string;round_no:number;round_name:string|null;deadline_at:string;team_name:string;base_points:number;captain_bonus:number;vice_captain_bonus:number;round_points:number;calculated_at:string;players:RoundDetail[]};
type PosGroup="G"|"D"|"F";

const posGroup=(p:string):PosGroup=>p==="G"?"G":p==="D"?"D":"F";
const order:Record<PosGroup,number>={G:0,D:1,F:2};
const fmt=(v:string)=>new Intl.DateTimeFormat("nb-NO",{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/Oslo"}).format(new Date(v));
const pts=(v:number)=>Number(v||0).toFixed(1).replace(".0","");

export default function RoundPointsView({rows,title="Mine rundepoeng",intro="Se nøyaktig hva laget og hver spiller har levert i ferdigscorede fantasy-runder.",emptyMessage="Ingen ferdigscorede fantasy-runder ennå.",testMode=false}:{rows:RoundDetail[];title?:string;intro?:string;emptyMessage?:string;testMode?:boolean}){
 const rounds=useMemo(()=>{const map=new Map<string,RoundSummary>();for(const r of rows){if(!map.has(r.round_id))map.set(r.round_id,{round_id:r.round_id,round_no:r.round_no,round_name:r.round_name,deadline_at:r.deadline_at,team_name:r.team_name,base_points:r.base_points,captain_bonus:r.captain_bonus,vice_captain_bonus:r.vice_captain_bonus,round_points:r.round_points,calculated_at:r.calculated_at,players:[]});map.get(r.round_id)!.players.push(r)}return[...map.values()].sort((a,b)=>b.round_no-a.round_no)},[rows]);
 const[selectedRound,setSelectedRound]=useState<string|null>(rounds[0]?.round_id||null);
 const current=rounds.find(r=>r.round_id===selectedRound)||rounds[0]||null;
 const seasonTotal=rounds.reduce((s,r)=>s+r.round_points,0),best=rounds.length?Math.max(...rounds.map(r=>r.round_points)):0,avg=rounds.length?seasonTotal/rounds.length:0;
 return <main className="fantasy-shell my-rounds-shell">
  <section className="team-builder-head"><div><p className="fantasy-kicker">STANG INN · FANTASY 2026/27{testMode?" · VISUELL TEST":""}</p><h1>{title}</h1><p>{intro}</p></div></section>
  <section className="team-metric-grid"><article><span>Totalt</span><strong>{pts(seasonTotal)}</strong></article><article><span>Scorede runder</span><strong>{rounds.length}</strong></article><article><span>Snitt</span><strong>{pts(avg)}</strong></article><article><span>Beste runde</span><strong>{pts(best)}</strong></article><article><span>Siste runde</span><strong>{rounds[0]?pts(rounds[0].round_points):"—"}</strong></article></section>
  {rounds.length===0&&<p className="team-message">{emptyMessage}</p>}
  {current&&<section className="round-detail-grid">
   <aside className="team-panel round-history-panel"><p className="eyebrow">RUNDEHISTORIKK</p><h2>{current.team_name}</h2><div className="round-history-list">{rounds.map(r=><button key={r.round_id} className={r.round_id===current.round_id?"active":""} onClick={()=>setSelectedRound(r.round_id)}><span><strong>{r.round_name||`Fantasy-runde ${r.round_no}`}</strong><small>Frist {fmt(r.deadline_at)}</small></span><b>{pts(r.round_points)} p</b></button>)}</div></aside>
   <div className="team-panel round-score-panel"><div className="round-score-head"><div><p className="eyebrow">RUNDE {current.round_no}</p><h2>{current.round_name||`Fantasy-runde ${current.round_no}`}</h2><p className="team-muted">Beregnet {fmt(current.calculated_at)}</p></div><div className="round-big-score"><span>Rundepoeng</span><strong>{pts(current.round_points)}</strong></div></div>
    <div className="round-bonus-strip"><span>Grunnpoeng <b>{pts(current.base_points)}</b></span><span>Kapteinbonus <b>+{pts(current.captain_bonus)}</b></span>{current.vice_captain_bonus>0&&<span>VC-bonus <b>+{pts(current.vice_captain_bonus)}</b></span>}</div>
    <div className="round-player-list">{[...current.players].sort((a,b)=>order[posGroup(a.player_position)]-order[posGroup(b.player_position)]||b.player_total_points-a.player_total_points).map(p=><div className="round-player-row" key={p.player_id}><span className={`team-pos team-pos-${posGroup(p.player_position).toLowerCase()}`}>{posGroup(p.player_position)}</span><div className="round-player-main"><strong>{p.player_name}{p.is_captain&&<em className="round-role">C</em>}{p.is_vice_captain&&<em className="round-role">VC</em>}</strong><small>{p.player_team} · {p.player_position} · {p.games_played} {p.games_played===1?"kamp":"kamper"}{!p.played?" · spilte ikke":""}</small></div><div className="round-player-calc"><small>{pts(p.raw_points)} rå{p.multiplier>1?` × ${pts(p.multiplier)}`:""}{p.bonus_points>0?` + ${pts(p.bonus_points)} bonus`:""}</small><strong>{pts(p.player_total_points)} p</strong></div></div>)}</div>
    <p className="team-save-note">Kapteinbonusen vises separat i rundetotalen. Visekaptein overtar bare når kapteinen ikke spiller.</p>
   </div>
  </section>}
 </main>
}
