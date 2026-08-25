"use client";

import {useEffect,useMemo,useState} from "react";
import {getSupabaseBrowserClient} from "../lib/supabase";
import styles from "./HomeRoundHistory.module.css";

const SEASON="2026/27";
type HistoryRow={round_id:string;round_no:number;round_points:number;round_position:number;event_type?:string|null;booster_type?:string|null};
const pts=(value:number)=>Number(value||0).toFixed(1).replace(".0","");

export default function HomeRoundHistory({teamId}:{teamId:string|null}){
 const[rows,setRows]=useState<HistoryRow[]>([]),[loading,setLoading]=useState(Boolean(teamId));
 useEffect(()=>{if(!teamId){setRows([]);setLoading(false);return}(async()=>{setLoading(true);try{const sb=getSupabaseBrowserClient();if(!sb)return;let data:unknown[]|null=null;let error:{message?:string}|null=null;const v3=await sb.rpc("get_fantasy_team_season_history_v3",{p_team_id:teamId,p_season:SEASON});data=v3.data as unknown[]|null;error=v3.error;if(error){const v2=await sb.rpc("get_fantasy_team_season_history_v2",{p_team_id:teamId,p_season:SEASON});data=v2.data as unknown[]|null;error=v2.error}if(error){setRows([]);return}setRows((data||[]).map((raw):HistoryRow=>{const x=raw as Record<string,unknown>;return{round_id:String(x.round_id||x.round_no),round_no:Number(x.round_no||0),round_points:Number(x.round_points||0),round_position:Number(x.round_position||0),event_type:x.event_type?String(x.event_type):null,booster_type:x.booster_type?String(x.booster_type):null}}).sort((a,b)=>a.round_no-b.round_no))}finally{setLoading(false)}})()},[teamId]);
 const recent=useMemo(()=>rows.slice(-6),[rows]);
 const max=useMemo(()=>Math.max(1,...recent.map(r=>r.round_points)),[recent]);
 if(!teamId)return <div className={styles.empty}>Rundehistorikk vises når Fantasy-laget er opprettet.</div>;
 if(loading)return <div className={styles.empty}>Laster rundehistorikk …</div>;
 if(!recent.length)return <div className={styles.empty}>Ingen scorede Fantasy-runder ennå.</div>;
 return <div className={styles.wrap}><div className={styles.chart}>{recent.map(row=><a href="/fantasy/leaderboard" className={styles.item} key={row.round_id} title={`Runde ${row.round_no}: ${pts(row.round_points)} poeng · ${row.round_position}. plass`}><strong>{pts(row.round_points)}</strong><span className={styles.track}><i style={{height:`${Math.max(18,Math.round(row.round_points/max*100))}%`}}/></span><small>R{row.round_no}</small>{(row.event_type||row.booster_type)&&<em>EVENT</em>}</a>)}</div><a className={styles.more} href="/fantasy/leaderboard">Se all historikk →</a></div>;
}
