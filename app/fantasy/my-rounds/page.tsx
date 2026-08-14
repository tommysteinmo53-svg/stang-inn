"use client";

import {useEffect,useMemo,useState} from "react";
import {getSupabaseBrowserClient} from "../../../lib/supabase";
import "../fantasy.css";

type Detail={round_id:string;round_no:number;round_name:string|null;deadline_at:string;team_round_points_id:string;team_id:string;team_name:string;base_points:number;captain_bonus:number;vice_captain_bonus:number;round_points:number;calculated_at:string;player_id:string;player_name:string;player_position:string;player_team:string;is_captain:boolean;is_vice_captain:boolean;played:boolean;games_played:number;raw_points:number;multiplier:number;bonus_points:number;player_total_points:number};
type RoundSummary={round_id:string;round_no:number;round_name:string|null;deadline_at:string;team_name:string;base_points:number;captain_bonus:number;vice_captain_bonus:number;round_points:number;calculated_at:string;players:Detail[]};
const SEASON="2026/27";
const posGroup=(p:string)=>p==="G"?"G":p==="D"?"D":"F";
const fmt=(v:string)=>new Intl.DateTimeFormat("nb-NO",{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/Oslo"}).format(new Date(v));
const pts=(v:number)=>Number(v||0).toFixed(1).replace(".0","");

export default function MyFantasyRoundsPage(){
 const[rows,setRows]=useState<Detail[]>([]),[busy,setBusy]=useState(true),[message,setMessage]=useState(""),[selectedRound,setSelectedRound]=useState<string|null>(null);
 useEffect(()=>{(async()=>{try{const sb=getSupabaseBrowserClient();if(!sb)throw new Error("Supabase er ikke tilgjengelig");const{data:s}=await sb.auth.getSession();if(!s.session)throw new Error("Du må være logget inn");const{data,error}=await sb.rpc("get_my_fantasy_round_details_v1",{p_season:SEASON,p_round_id:null});if(error)throw error;const parsed=(data||[]).map((r:any)=>({...r,round_no:Number(r.round_no),base_points:Number(r.base_points),captain_bonus:Number(r.captain_bonus),vice_captain_bonus:Number(r.vice_captain_bonus),round_points:Number(r.round_points),games_played:Number(r.games_played),raw_points:Number(r.raw_points),multiplier:Number(r.multiplier),bonus_points:Number(r.bonus_points),player_total_points:Number(r.player_total_points)})) as Detail[];setRows(parsed);if(parsed[0])setSelectedRound(parsed[0].round_id);setMessage(parsed.length?"":"Ingen ferdigscorede fantasy-runder ennå.")}catch(e:any){setMessage(`Kunne ikke hente rundepoeng: ${e.message||e}`)}finally{setBusy(false)}})()},[]);
 const rounds=useMemo(()=>{const map=new Map<string,RoundSummary>();for(const r of rows){if(!map.has(r.round_id))map.set(r.round_id,{round_id:r.round_id,round_no:r.round_no,round_name:r.round_name,deadline_at:r.deadline_at,team_name:r.team_name,base_points:r.base_points,captain_bonus:r.captain_bonus,vice_captain_bonus:r.vice_captain_bonus,round_points:r.round_points,calculated_at:r.calculated_at,players:[]});map.get(r.round_id)!.players.push(r)}return[...map.values()].sort((a,b)=>b.round_no-a.round_no)},[rows]);
 const current=rounds.find(r=>r.round_id===selectedRound)||rounds[0]||null;
 const seasonTotal=rounds.reduce((s,r)=>s+r.round_points,0),best=rounds.length?Math.max(...rounds.map(r=>r.round_points)):0,avg=rounds.length?seasonTotal/rounds.length:0;
 if(busy)return <main className="fantasy-shell"><p className="fantasy-lead">Henter rundepoeng …</p></main>;
 return <main className="fantasy-shell my-rounds-shell">
  <section className="team-builder-head"><div><p className="fantasy-kicker">STANG INN · FANTASY 2026/27</p><h1>Mine rundepoeng</h1><p>Se nøyaktig hva laget og hver spiller har levert i ferdigscorede fantasy-runder.</p></div></section>
  <section className="team-metric-grid"><article><span>Totalt</span><strong>{pts(seasonTotal)}</strong></article><article><span>Scorede runder</span><strong>{rounds.length}</strong></article><article><span>Snitt</span><strong>{pts(avg)}</strong></article><article><span>Beste runde</span><strong>{pts(best)}</strong></article><article><span>Siste runde</span><strong>{rounds[0]?pts(rounds[0].round_points):"—"}</strong></article></section>
  {message&&<p className="team-message">{message}</p>}
  {current&&<section className="round-detail-grid">
   <aside className="team-panel round-history-panel"><p className="eyebrow">RUNDEHISTORIKK</p><h2>{current.team_name}</h2><div className="round-history-list">{rounds.map(r=><button key={r.round_id} className={r.round_id===current.round_id?"active":""} onClick={()=>setSelectedRound(r.round_id)}><span><strong>{r.round_name||`Fantasy-runde ${r.round_no}`}</strong><small>Frist {fmt(r.deadline_at)}</small></span><b>{pts(r.round_points)} p</b></button>)}</div></aside>
   <div className="team-panel round-score-panel"><div className="round-score-head"><div><p className="eyebrow">RUNDE {current.round_no}</p><h2>{current.round_name||`Fantasy-runde ${current.round_no}`}</h2><p className="team-muted">Beregnet {fmt(current.calculated_at)}</p></div><div className="round-big-score"><span>Rundepoeng</span><strong>{pts(current.round_points)}</strong></div></div>
    <div className="round-bonus-strip"><span>Grunnpoeng <b>{pts(current.base_points)}</b></span><span>Kapteinbonus <b>+{pts(current.captain_bonus)}</b></span>{current.vice_captain_bonus>0&&<span>VC-bonus <b>+{pts(current.vice_captain_bonus)}</b></span>}</div>
    <div className="round-player-list">{[...current.players].sort((a,b)=>({G:0,D:1,F:2}[posGroup(a.player_position)]-({G:0,D:1,F:2}[posGroup(b.player_position)])||b.player_total_points-a.player_total_points).map(p=><div className="round-player-row" key={p.player_id}><span className={`team-pos team-pos-${posGroup(p.player_position).toLowerCase()}`}>{posGroup(p.player_position)}</span><div className="round-player-main"><strong>{p.player_name}{p.is_captain&&<em className="round-role">C</em>}{p.is_vice_captain&&<em className="round-role">VC</em>}</strong><small>{p.player_team} · {p.player_position} · {p.games_played} {p.games_played===1?"kamp":"kamper"}{!p.played?" · spilte ikke":""}</small></div><div className="round-player-calc"><small>{pts(p.raw_points)} rå{p.multiplier>1?` × ${pts(p.multiplier)}`:""}{p.bonus_points>0?` + ${pts(p.bonus_points)} bonus`:""}</small><strong>{pts(p.player_total_points)} p</strong></div></div>)}</div>
    <p className="team-save-note">Kapteinbonusen vises separat i rundetotalen. Visekaptein overtar bare når kapteinen ikke spiller.</p>
   </div>
  </section>}
 </main>
}
