"use client";

import {useEffect,useMemo,useState} from "react";
import {getSupabaseBrowserClient} from "../lib/supabase";
import SIIcon from "./SIIcon";

const SEASON="2026/27";
type TeamPlayer={player_id:string;line_no:number|null;is_captain:boolean;is_vice_captain:boolean};
type Player={id:string;name:string;team:string;position:"C"|"W"|"D"|"G"};
type Card=Player&{lineNo:1|2;price:number;captain:boolean;vice:boolean};
type PositionGroup="G"|"D"|"F";
type PriceRow={player_id:string;price:number|string|null};
const GROUP_ORDER:Record<PositionGroup,number>={G:0,D:1,F:2};
const group=(p:Player):PositionGroup=>p.position==="D"?"D":p.position==="G"?"G":"F";
const order=(a:Card,b:Card)=>GROUP_ORDER[group(a)]-GROUP_ORDER[group(b)]||a.name.localeCompare(b.name,"nb");
const slotClass=(player:Card,index:number)=>{const g=group(player);if(g==="G")return"slot-g";if(g==="D")return`slot-d${Math.min(index+1,2)}`;return`slot-f${Math.min(index+1,3)}`};

export default function HomeFantasyLineup({teamId}:{teamId:string|null}){
 const[line,setLine]=useState<1|2>(1),[cards,setCards]=useState<Card[]>([]),[loading,setLoading]=useState(Boolean(teamId));
 useEffect(()=>{if(!teamId){setCards([]);setLoading(false);return}(async()=>{setLoading(true);try{const sb=getSupabaseBrowserClient();if(!sb)return;const{data:tp}=await sb.from("fantasy_user_team_players").select("player_id,line_no,is_captain,is_vice_captain").eq("team_id",teamId);const rows=(tp||[])as TeamPlayer[],ids=rows.map(r=>r.player_id);if(!ids.length){setCards([]);return}const[{data:p},{data:prices}]=await Promise.all([sb.from("fantasy_players").select("id,name,team,position").in("id",ids),sb.from("fantasy_player_season_prices").select("player_id,price").eq("season",SEASON).in("player_id",ids)]);const priceRows=(prices||[])as PriceRow[];const priceMap=new Map<string,number>(priceRows.map(x=>[String(x.player_id),Number(x.price)||0]));const meta=new Map<string,TeamPlayer>(rows.map(r=>[r.player_id,r]));setCards(((p||[])as Player[]).map((player):Card=>{const m=meta.get(player.id);const lineNo:1|2=Number(m?.line_no)===2?2:1;return{...player,lineNo,price:priceMap.get(player.id)||0,captain:Boolean(m?.is_captain),vice:Boolean(m?.is_vice_captain)}}).sort(order))}finally{setLoading(false)}})()},[teamId]);
 const visible=useMemo(()=>cards.filter(p=>p.lineNo===line).sort(order),[cards,line]);
 const positioned=useMemo(()=>{const counters:Record<PositionGroup,number>={G:0,D:0,F:0};return visible.map(player=>{const g=group(player);const slot=slotClass(player,counters[g]);counters[g]+=1;return{player,slot}})},[visible]);
 if(!teamId)return <div className="homeLineupEmpty"><SIIcon name="team" size={28}/><strong>Opprett Fantasy-laget ditt</strong><span>Spillerkortene vises her når laget er lagret.</span></div>;
 if(loading)return <div className="homeLineupEmpty"><strong>Laster lagoppstilling …</strong></div>;
 return <div className="homeLineup"><div className="homeLineupTabs" role="tablist" aria-label="Velg rekke"><button type="button" role="tab" aria-selected={line===1} className={line===1?"active":""} onClick={()=>setLine(1)}>1. rekke</button><button type="button" role="tab" aria-selected={line===2} className={line===2?"active":""} onClick={()=>setLine(2)}>2. rekke</button></div><div className="homeLineupRink" aria-label={`${line}. rekke`}><div className="rinkRedLine"/><div className="rinkBlueLine rinkBlueLeft"/><div className="rinkBlueLine rinkBlueRight"/><div className="rinkCenterCircle"/><div className="rinkGoalCrease"/>{positioned.length?positioned.map(({player,slot})=><a href={`/fantasy/players/${player.id}`} className={`homePlayerCard ${slot}`} key={player.id}><span className="homePlayerJersey"><span className="jerseyShoulder"/><SIIcon name="player" size={26}/>{player.captain&&<b>C</b>}{player.vice&&<b>VC</b>}</span><span className="homePlayerName"><strong>{player.name}</strong><small>{player.team} · {player.price.toFixed(1)}m</small></span></a>):<div className="homeLineupEmpty compact"><strong>Ingen spillere i denne rekken.</strong></div>}</div></div>;
}
