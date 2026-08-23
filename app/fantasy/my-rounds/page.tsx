"use client";

import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "../../../lib/supabase";
import RoundPointsView,{type RoundDetail} from "./RoundPointsView";
import "../fantasy.css";
import "./bonus-history.css";

const SEASON="2026/27";

export default function MyFantasyRoundsPage(){
 const[rows,setRows]=useState<RoundDetail[]>([]),[busy,setBusy]=useState(true),[message,setMessage]=useState("");
 useEffect(()=>{(async()=>{try{const sb=getSupabaseBrowserClient();if(!sb)throw new Error("Supabase er ikke tilgjengelig");const{data:s}=await sb.auth.getSession();if(!s.session)throw new Error("Du må være logget inn");const{data,error}=await sb.rpc("get_my_fantasy_round_details_v2",{p_season:SEASON,p_round_id:null});if(error)throw error;const parsed=(data||[]).map((r:any)=>({...r,round_no:Number(r.round_no),base_points:Number(r.base_points),captain_bonus:Number(r.captain_bonus),vice_captain_bonus:Number(r.vice_captain_bonus),round_points:Number(r.round_points),games_played:Number(r.games_played),raw_points:Number(r.raw_points),line_no:Number(r.line_no||1),line_multiplier:Number(r.line_multiplier??1),role_multiplier:Number(r.role_multiplier??1),multiplier:Number(r.multiplier),bonus_points:Number(r.bonus_points),player_total_points:Number(r.player_total_points),event_budget:r.event_budget==null?null:Number(r.event_budget),captain_multiplier_override:r.captain_multiplier_override==null?null:Number(r.captain_multiplier_override),line2_multiplier_override:r.line2_multiplier_override==null?null:Number(r.line2_multiplier_override)})) as RoundDetail[];setRows(parsed)}catch(e:any){setMessage(`Kunne ikke hente rundepoeng: ${e.message||e}`)}finally{setBusy(false)}})()},[]);
 if(busy)return <main className="fantasy-shell"><p className="fantasy-lead">Henter rundepoeng …</p></main>;
 if(message)return <main className="fantasy-shell my-rounds-shell"><section className="team-builder-head"><div><p className="fantasy-kicker">STANG INN · FANTASY 2026/27</p><h1>Mine rundepoeng</h1></div></section><p className="team-message">{message}</p></main>;
 return <RoundPointsView rows={rows}/>;
}
