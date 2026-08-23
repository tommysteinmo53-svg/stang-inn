"use client";

import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "../../../lib/supabase";
import PointsSectionNav from "../PointsSectionNav";
import RoundPointsView,{type RoundDetail} from "./RoundPointsView";
import "../fantasy.css";
import "./bonus-history.css";

const SEASON="2026/27";
const num=(v:any)=>v==null?null:Number(v);

export default function MyFantasyRoundsPage(){
 const[rows,setRows]=useState<RoundDetail[]>([]),[busy,setBusy]=useState(true),[message,setMessage]=useState("");
 useEffect(()=>{(async()=>{try{const sb=getSupabaseBrowserClient();if(!sb)throw new Error("Supabase er ikke tilgjengelig");const{data:s}=await sb.auth.getSession();if(!s.session)throw new Error("Du må være logget inn");const result=await sb.rpc("get_my_fantasy_round_history_v1",{p_season:SEASON,p_round_id:null});if(result.error)throw result.error;const parsed=(result.data||[]).map((r:any)=>({...r,round_no:Number(r.round_no),squad_value:Number(r.squad_value),base_points:num(r.base_points),captain_bonus:num(r.captain_bonus),vice_captain_bonus:num(r.vice_captain_bonus),round_points:num(r.round_points),transfer_count:Number(r.transfer_count||0),transfers:Array.isArray(r.transfers)?r.transfers:[],player_price:Number(r.player_price),line_no:Number(r.line_no||1),games_played:num(r.games_played),raw_points:num(r.raw_points),line_multiplier:num(r.line_multiplier),role_multiplier:num(r.role_multiplier),multiplier:num(r.multiplier),bonus_points:num(r.bonus_points),player_total_points:num(r.player_total_points),event_budget:num(r.event_budget),captain_multiplier_override:num(r.captain_multiplier_override),line2_multiplier_override:num(r.line2_multiplier_override)})) as RoundDetail[];setRows(parsed)}catch(e:any){setMessage(`Kunne ikke hente rundehistorikk: ${e.message||e}`)}finally{setBusy(false)}})()},[]);
 if(busy)return <main className="fantasy-shell"><PointsSectionNav/><p className="fantasy-lead">Henter rundehistorikk …</p></main>;
 if(message)return <main className="fantasy-shell my-rounds-shell"><PointsSectionNav/><section className="team-builder-head"><div><p className="fantasy-kicker">STANG INN · FANTASY 2026/27</p><h1>Rundehistorikk</h1></div></section><p className="team-message">{message}</p></main>;
 return <><div className="fantasy-shell" style={{paddingBottom:0}}><PointsSectionNav/></div><RoundPointsView rows={rows} emptyMessage="Rundehistorikken blir tilgjengelig når laget ditt først er låst ved en fantasy-deadline."/></>;
}
