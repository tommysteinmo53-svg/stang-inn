"use client";

import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "../../lib/supabase";
import "./fantasy.css";

const SEASON="2026/27";
type Dash={teamName:string;teamId:string|null;players:number;teamCost:number;transfersUsed:number;transfersRemaining:number;roundNo:number|null;deadline:string|null;totalPoints:number;position:number|null;streak:number;title:string;icon:string};
const initial:Dash={teamName:"Mitt lag",teamId:null,players:0,teamCost:0,transfersUsed:0,transfersRemaining:2,roundNo:null,deadline:null,totalPoints:0,position:null,streak:0,title:"Rookie",icon:"🌱"};
const fmt=(v:string)=>new Intl.DateTimeFormat("nb-NO",{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/Oslo"}).format(new Date(v));

export default function FantasyHomePage(){
 const[data,setData]=useState<Dash>(initial),[loading,setLoading]=useState(true),[message,setMessage]=useState("");
 useEffect(()=>{(async()=>{try{
  const sb=getSupabaseBrowserClient();if(!sb)throw new Error("Supabase er ikke tilgjengelig");
  const{data:s}=await sb.auth.getSession();const user=s.session?.user;if(!user)throw new Error("Du må være logget inn for å spille Fantasy.");
  const{data:team,error:te}=await sb.from("fantasy_user_teams").select("id,name").eq("season",SEASON).eq("user_id",user.id).maybeSingle();if(te)throw te;
  if(!team){setMessage("Du har ikke opprettet Fantasy-lag ennå.");setLoading(false);return}
  const[{count:players},{data:ts},{data:board},{data:ach}]=await Promise.all([
   sb.from("fantasy_user_team_players").select("player_id",{count:"exact",head:true}).eq("team_id",team.id),
   sb.rpc("get_fantasy_transfer_status_v1",{p_season:SEASON}),
   sb.rpc("get_fantasy_season_leaderboard",{p_season:SEASON}),
   sb.rpc("get_fantasy_team_achievements",{p_season:SEASON})
  ]);
  const status=Array.isArray(ts)?ts[0]:null;
  const mine=(board||[]).find((r:any)=>r.team_id===team.id);
  const myAch=(ach||[]).find((r:any)=>r.team_id===team.id);
  setData({teamName:team.name||"Mitt lag",teamId:team.id,players:Number(players||0),teamCost:Number(status?.team_cost||0),transfersUsed:Number(status?.transfers_used||0),transfersRemaining:Number(status?.transfers_remaining??2),roundNo:status?.effective_round_no?Number(status.effective_round_no):null,deadline:status?.deadline_at||null,totalPoints:Number(mine?.total_points||0),position:mine?.standings_position?Number(mine.standings_position):null,streak:Number(myAch?.current_streak||0),title:myAch?.expert_title||"Rookie",icon:myAch?.expert_icon||"🌱"});
 }catch(e:any){setMessage(e?.message||String(e))}finally{setLoading(false)}})()},[]);
 if(loading)return <main className="fantasy-shell fantasy-dashboard-shell"><p className="fantasy-lead">Laster Fantasy-oversikten …</p></main>;
 return <main className="fantasy-shell fantasy-dashboard-shell">
  <section className="fantasy-dashboard-hero"><div><p className="fantasy-kicker">STANG INN · EHL FANTASY 2026/27</p><h1>{data.teamId?data.teamName:"EHL Fantasy"}</h1><p>{data.teamId?"Lagstatus, rundepoeng og neste deadline samlet på ett sted.":"Bygg ditt lag med 12 spillere og konkurrer gjennom hele EHL-sesongen."}</p></div><div className="fantasy-dashboard-deadline"><span>Neste deadline</span><strong>{data.deadline?fmt(data.deadline):"Ikke startet"}</strong><small>{data.roundNo?`Fantasy-runde ${data.roundNo}`:"Før sesongstart kan laget endres fritt"}</small></div></section>
  <section className="fantasy-dashboard-grid"><article><span>Lag</span><strong>{data.players}/12</strong><small>{data.players===12?"Komplett tropp":"Spillere valgt"}</small></article><article><span>Lagverdi</span><strong>{data.teamCost?`${data.teamCost.toFixed(1)}m`:"—"}</strong><small>Faste 2026/27-priser</small></article><article><span>Sesongpoeng</span><strong>{data.totalPoints.toFixed(1).replace(".0","")}</strong><small>{data.position?`Plass ${data.position}`:"Ingen scorede runder"}</small></article><article><span>Bytter</span><strong>{data.transfersUsed}/2</strong><small>{data.transfersRemaining} igjen i runden</small></article></section>
  <section className="fantasy-dashboard-actions"><a className="fantasy-dashboard-card" href="/fantasy/team"><b>👥 Mitt lag</b><span>Bytt spillere, sett C ×2 og VC ×1,5 og organiser 1. og 2. rekke.</span></a><a className="fantasy-dashboard-card" href="/fantasy/players"><b>🧍 Spillere</b><span>Sammenlign spillere, priser, Fantasy-poeng og kommende motstandere.</span></a><a className="fantasy-dashboard-card" href="/fantasy/my-rounds"><b>📊 Poeng</b><span>Se rundehistorikk og nøyaktig hvilke spillere som har levert poengene dine.</span></a><a className="fantasy-dashboard-card" href="/fantasy/leaderboard"><b>🏆 Leaderboard · {data.icon} {data.title}</b><span>Se plassering, streak {data.streak}, achievements, rundeseire og historikk.</span></a><a className="fantasy-dashboard-card" href="/fantasy/leagues"><b>🤝 Private ligaer</b><span>Lag en vennegjeng-liga, del invitasjonskode og følg egen tabell.</span></a><a className="fantasy-dashboard-card" href="/fantasy/rounds"><b>📅 Fantasy-runder</b><span>Se kampene og deadline i hver kalenderbaserte fantasy-runde.</span></a><a className="fantasy-dashboard-card" href="/fantasy/rules"><b>📖 Regler og scoring</b><span>Se poengsystemet, kapteinregler og hvordan spillet fungerer.</span></a></section>
  {message&&<div className="fantasy-dashboard-status">{message}{!data.teamId&&<> <a href="/fantasy/team">Opprett laget ditt →</a></>}</div>}
 </main>
}
