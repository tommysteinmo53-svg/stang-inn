"use client";

import {useEffect,useMemo,useState} from "react";
import {getSupabaseBrowserClient} from "../../../lib/supabase";
import "../fantasy.css";

const SEASON="2026/27";
type Achievement={team_id:string;current_streak:number;longest_streak:number;expert_title:string;expert_icon:string;title_reason:string};
type Monthly={month_key:string;month_start:string;standings_position:number;team_id:string;team_name:string;monthly_points:number;rounds_scored:number;round_wins:number};
const monthName=(v:string)=>new Intl.DateTimeFormat("nb-NO",{month:"long",year:"numeric",timeZone:"Europe/Oslo"}).format(new Date(`${v}T12:00:00Z`));
const pts=(n:number)=>Number(n||0).toFixed(1).replace(".0","");

export default function FantasyAchievementsPage(){
 const[mine,setMine]=useState<Achievement|null>(null),[monthly,setMonthly]=useState<Monthly[]>([]),[teamName,setTeamName]=useState("Mitt lag"),[message,setMessage]=useState(""),[loading,setLoading]=useState(true);
 useEffect(()=>{(async()=>{try{
  const sb=getSupabaseBrowserClient();if(!sb)throw new Error("Supabase er ikke tilgjengelig");const{data:s}=await sb.auth.getSession();const user=s.session?.user;if(!user)throw new Error("Du må være logget inn");
  const{data:team}=await sb.from("fantasy_user_teams").select("id,name").eq("season",SEASON).eq("user_id",user.id).maybeSingle();
  const[{data:a,error:ae},{data:m,error:me}]=await Promise.all([sb.rpc("get_fantasy_team_achievements",{p_season:SEASON}),sb.rpc("get_fantasy_monthly_leaderboard",{p_season:SEASON})]);if(ae)throw ae;if(me)throw me;
  if(team){setTeamName(team.name||"Mitt lag");setMine(((a||[]).find((r:any)=>r.team_id===team.id)||null) as Achievement|null)}else setMessage("Du har ikke opprettet Fantasy-lag ennå.");
  setMonthly((m||[]).map((r:any)=>({...r,standings_position:Number(r.standings_position),monthly_points:Number(r.monthly_points),rounds_scored:Number(r.rounds_scored),round_wins:Number(r.round_wins)})) as Monthly[]);
 }catch(e:any){setMessage(e?.message||String(e))}finally{setLoading(false)}})()},[]);
 const winners=useMemo(()=>{const seen=new Set<string>();return monthly.filter(r=>{if(r.standings_position!==1||seen.has(r.month_key))return false;seen.add(r.month_key);return true})},[monthly]);
 if(loading)return <main className="fantasy-shell fantasy-dashboard-shell"><p className="fantasy-lead">Henter achievements …</p></main>;
 return <main className="fantasy-shell fantasy-dashboard-shell"><section className="team-builder-head"><div><p className="fantasy-kicker">STANG INN · FANTASY 2026/27</p><h1>Achievements</h1><p>Månedsvinnere, streaks og eksperttitler gjennom sesongen.</p></div></section>
  <section className="fantasy-achievements-grid"><article className="fantasy-achievement-card"><span>Eksperttittel</span><strong>{mine?`${mine.expert_icon} ${mine.expert_title}`:"🌱 Rookie"}</strong><p>{mine?.title_reason||"Konkurransetittelen aktiveres etter minst tre scorede runder."}</p></article><article className="fantasy-achievement-card"><span>Nåværende streak</span><strong>🔥 {mine?.current_streak||0}</strong><p>Antall scorede runder på rad med plassering i øvre halvdel av feltet.</p></article><article className="fantasy-achievement-card"><span>Streak-rekord</span><strong>⚡ {mine?.longest_streak||0}</strong><p>Din lengste sammenhengende streak så langt denne sesongen.</p></article></section>
  <section className="team-panel" style={{marginTop:16}}><p className="eyebrow">MÅNEDSVINNERE</p><h2>{teamName}</h2>{winners.length===0?<p className="team-muted">Ingen månedsvinnere er kåret ennå.</p>:<div className="fantasy-month-list">{winners.map(w=><div className="fantasy-month-row" key={w.month_key}><span><strong>🏆 {monthName(w.month_start)}</strong><small>{w.team_name} · {w.rounds_scored} runder · {w.round_wins} rundeseire</small></span><b>{pts(w.monthly_points)} p</b></div>)}</div>}</section>
  {message&&<div className="fantasy-dashboard-status">{message}</div>}
 </main>
}
