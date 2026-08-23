"use client";

import {useMemo,useState} from "react";

type TransferPlayer={player_id:string;name:string;team:string;position:string;price:number};
type TransferBatch={batch_id:string;created_at:string;transfer_count:number;before_cost:number;after_cost:number;outgoing:TransferPlayer[];incoming:TransferPlayer[]};
export type RoundDetail={
 round_id:string;round_no:number;round_name:string|null;deadline_at:string;snapshot_id:string;captured_at:string;team_id:string;team_name:string;squad_value:number;
 booster_type?:string|null;event_type?:string|null;event_budget?:number|null;captain_multiplier_override?:number|null;line2_multiplier_override?:number|null;
 is_scored:boolean;team_round_points_id?:string|null;base_points?:number|null;captain_bonus?:number|null;vice_captain_bonus?:number|null;round_points?:number|null;calculated_at?:string|null;
 transfer_count:number;transfers:TransferBatch[];
 player_id:string;player_name:string;player_position:string;player_team:string;player_price:number;line_no:number;is_captain:boolean;is_vice_captain:boolean;
 played?:boolean|null;games_played?:number|null;raw_points?:number|null;line_multiplier?:number|null;role_multiplier?:number|null;multiplier?:number|null;bonus_points?:number|null;player_total_points?:number|null;
};
type RoundSummary={
 round_id:string;round_no:number;round_name:string|null;deadline_at:string;snapshot_id:string;captured_at:string;team_id:string;team_name:string;squad_value:number;
 booster_type?:string|null;event_type?:string|null;event_budget?:number|null;captain_multiplier_override?:number|null;line2_multiplier_override?:number|null;
 is_scored:boolean;team_round_points_id?:string|null;base_points?:number|null;captain_bonus?:number|null;vice_captain_bonus?:number|null;round_points?:number|null;calculated_at?:string|null;
 transfer_count:number;transfers:TransferBatch[];players:RoundDetail[];
};
type PosGroup="G"|"D"|"F";

const posGroup=(p:string):PosGroup=>p==="G"?"G":p==="D"?"D":"F";
const order:Record<PosGroup,number>={G:0,D:1,F:2};
const fmt=(v?:string|null)=>v?new Intl.DateTimeFormat("nb-NO",{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/Oslo"}).format(new Date(v)):"—";
const pts=(v?:number|null)=>v==null?"—":Number(v).toFixed(1).replace(".0","");
const boosterLabel=(v?:string|null)=>v==="captain_boost"?"⭐ Kapteinsboost":v==="line_boost"?"🔥 Rekkeboost":v==="transfer_boost"?"🔄 Bytteboost":null;
const eventLabel=(v?:string|null)=>v==="rich_uncle"?"💰 Rik Onkel":v==="poor_uncle"?"🪙 Fattig Onkel":null;
const roleText=(p:RoundDetail,r:RoundSummary)=>p.is_captain?`C ×${pts(p.role_multiplier??r.captain_multiplier_override??2)}`:p.is_vice_captain?"VC ×1,5":null;
const toSummary=(r:RoundDetail):RoundSummary=>({
 round_id:r.round_id,round_no:r.round_no,round_name:r.round_name,deadline_at:r.deadline_at,snapshot_id:r.snapshot_id,captured_at:r.captured_at,team_id:r.team_id,team_name:r.team_name,squad_value:r.squad_value,
 booster_type:r.booster_type,event_type:r.event_type,event_budget:r.event_budget,captain_multiplier_override:r.captain_multiplier_override,line2_multiplier_override:r.line2_multiplier_override,
 is_scored:r.is_scored,team_round_points_id:r.team_round_points_id,base_points:r.base_points,captain_bonus:r.captain_bonus,vice_captain_bonus:r.vice_captain_bonus,round_points:r.round_points,calculated_at:r.calculated_at,
 transfer_count:r.transfer_count,transfers:r.transfers,players:[]
});

export default function RoundPointsView({rows,title="Rundehistorikk",intro="Åpne tidligere fantasy-runder og se nøyaktig laget som ble låst ved deadline. Historiske lag kommer alltid fra autoritative snapshots.",emptyMessage="Ingen låste fantasy-runder ennå.",testMode=false}:{rows:RoundDetail[];title?:string;intro?:string;emptyMessage?:string;testMode?:boolean}){
 const rounds=useMemo(()=>{const map=new Map<string,RoundSummary>();for(const r of rows){if(!map.has(r.round_id))map.set(r.round_id,toSummary(r));map.get(r.round_id)!.players.push(r)}return[...map.values()].sort((a,b)=>b.round_no-a.round_no)},[rows]);
 const[selectedRound,setSelectedRound]=useState<string|null>(rounds[0]?.round_id||null);
 const current=rounds.find(r=>r.round_id===selectedRound)||rounds[0]||null;
 const scored=rounds.filter(r=>r.is_scored&&r.round_points!=null);
 const seasonTotal=scored.reduce((s,r)=>s+Number(r.round_points||0),0);
 const best=scored.length?Math.max(...scored.map(r=>Number(r.round_points||0))):null;
 const avg=scored.length?seasonTotal/scored.length:null;
 const renderLine=(lineNo:number)=>{const round=current;if(!round)return null;const players=round.players.filter(p=>p.line_no===lineNo).sort((a,b)=>order[posGroup(a.player_position)]-order[posGroup(b.player_position)]||a.player_name.localeCompare(b.player_name,"nb"));const lineMultiplier=round.line2_multiplier_override!=null&&lineNo===2?round.line2_multiplier_override:(lineNo===2?0.5:1);return <section className="round-line-block"><div className="round-line-head"><div><span>REKKE {lineNo}</span><strong>{pts(lineMultiplier)}× uttelling</strong></div>{lineNo===2&&round.booster_type==="line_boost"&&<em>🔥 REKKEBOOST</em>}</div><div className="round-player-list">{players.map(p=><div className="round-player-row" key={p.player_id}><span className={`team-pos team-pos-${posGroup(p.player_position).toLowerCase()}`}>{posGroup(p.player_position)}</span><div className="round-player-main"><strong><a href={`/fantasy/players/${p.player_id}`} className="round-player-link">{p.player_name}</a>{roleText(p,round)&&<em className="round-role">{roleText(p,round)}</em>}</strong><small>{p.player_team} · {p.player_position} · {pts(p.player_price)}m{round.is_scored?` · ${p.games_played??0} ${(p.games_played??0)===1?"kamp":"kamper"}${p.played===false?" · spilte ikke":""}`:""}</small></div><div className="round-player-calc">{round.is_scored?<><small>{pts(p.raw_points)} rå · rekke ×{pts(p.line_multiplier??lineMultiplier)}{(p.role_multiplier??1)>1?` · rolle ×${pts(p.role_multiplier)}`:""}</small><strong>{pts(p.player_total_points)} p</strong></>:<><small>Snapshot ved deadline</small><strong>—</strong></>}</div></div>)}</div></section>};
 return <main className="fantasy-shell my-rounds-shell">
  <section className="team-builder-head"><div><p className="fantasy-kicker">STANG INN · FANTASY 2026/27{testMode?" · VISUELL TEST":""}</p><h1>{title}</h1><p>{intro}</p></div></section>
  <section className="team-metric-grid"><article><span>Totalt</span><strong>{pts(seasonTotal)}</strong></article><article><span>Låste runder</span><strong>{rounds.length}</strong></article><article><span>Scorede runder</span><strong>{scored.length}</strong></article><article><span>Snitt</span><strong>{pts(avg)}</strong></article><article><span>Beste runde</span><strong>{pts(best)}</strong></article></section>
  {rounds.length===0&&<p className="team-message">{emptyMessage}</p>}
  {current&&<section className="round-detail-grid">
   <aside className="team-panel round-history-panel"><p className="eyebrow">RUNDEHISTORIKK</p><h2>{current.team_name}</h2><div className="round-history-list">{rounds.map(r=>{const special=eventLabel(r.event_type)||boosterLabel(r.booster_type);return <button key={r.round_id} className={r.round_id===current.round_id?"active":""} onClick={()=>setSelectedRound(r.round_id)}><span><strong>{r.round_name||`Fantasy-runde ${r.round_no}`}</strong>{special&&<small className="round-special-label">{special}</small>}<small>Frist {fmt(r.deadline_at)}</small></span><b>{r.is_scored?`${pts(r.round_points)} p`:"Låst"}</b></button>})}</div></aside>
   <div className="team-panel round-score-panel"><div className="round-score-head"><div><p className="eyebrow">RUNDE {current.round_no}</p><h2>{current.round_name||`Fantasy-runde ${current.round_no}`}</h2><p className="team-muted">Frist {fmt(current.deadline_at)} · Snapshot {fmt(current.captured_at)}</p><p className="team-muted">Lagverdi ved snapshot: {pts(current.squad_value)}m</p></div><div className="round-big-score"><span>{current.is_scored?"Rundepoeng":"Status"}</span><strong>{current.is_scored?pts(current.round_points):"LÅST"}</strong></div></div>
    {(current.event_type||current.booster_type)&&<div className="round-special-banner"><strong>{eventLabel(current.event_type)||boosterLabel(current.booster_type)}</strong><span>{current.event_type?`Felles Event Week${current.event_budget?` · budsjett ${pts(current.event_budget)}m`:""}`:current.booster_type==="captain_boost"?"Kapteinen fikk ×2,5 denne runden.":current.booster_type==="line_boost"?"Rekke 2 telte 100 % denne runden.":"Opptil 4 permanente spillerbytter var tilgjengelig før runden."}</span></div>}
    {current.is_scored?<div className="round-bonus-strip"><span>Grunnpoeng <b>{pts(current.base_points)}</b></span><span>Kaptein ×{pts(current.captain_multiplier_override??2)} <b>+{pts(current.captain_bonus)}</b></span><span>Visekaptein ×1,5 <b>+{pts(current.vice_captain_bonus)}</b></span>{current.line2_multiplier_override!=null&&<span>Rekke 2 ×{pts(current.line2_multiplier_override)} <b>aktiv</b></span>}</div>:<p className="round-unscored-note">Laget er fryst og kan vises allerede nå. Poeng kobles på dette snapshotet når runden er ferdigscoret.</p>}
    {renderLine(1)}{renderLine(2)}
    {!current.event_type&&current.transfer_count>0&&<section className="round-transfer-block"><div className="round-line-head"><div><span>BYTTER FØR RUNDEN</span><strong>{current.transfer_count} {current.transfer_count===1?"bytte":"bytter"}</strong></div></div>{current.transfers.map(batch=><div className="round-transfer-batch" key={batch.batch_id}><div className="round-transfer-columns"><div><b>UT</b>{batch.outgoing.map(p=><span key={p.player_id}>{p.name}</span>)}</div><div><b>INN</b>{batch.incoming.map(p=><span key={p.player_id}>{p.name}</span>)}</div></div></div>)}</section>}
    <p className="team-save-note">Dette er laget som faktisk ble låst ved rundens deadline. Spillere, rekker, C/VC, priser og event/booster-regler leses fra snapshotet og påvirkes ikke av senere transfers eller lagendringer.</p>
   </div>
  </section>}
 </main>
}
