"use client";

import {useEffect,useMemo,useState} from "react";
import {getSupabaseBrowserClient} from "../lib/supabase";
import styles from "./HomeFantasyLineup.module.css";

const SEASON="2026/27";
type TeamPlayer={player_id:string;line_no:number|null;is_captain:boolean;is_vice_captain:boolean};
type Player={id:string;name:string;team:string;position:"C"|"W"|"D"|"G"};
type Card=Player&{lineNo:1|2;price:number;captain:boolean;vice:boolean};
type PositionGroup="G"|"D"|"F";
type PriceRow={player_id:string;price:number|string|null};
const group=(p:Player):PositionGroup=>p.position==="D"?"D":p.position==="G"?"G":"F";
const groupOrder:Record<PositionGroup,number>={F:0,D:1,G:2};
const sortFormation=(a:Card,b:Card)=>groupOrder[group(a)]-groupOrder[group(b)]||a.name.localeCompare(b.name,"nb");
function buildLine1(ids:string[],players:Player[],preferred:string[]=[]){const chosen=ids.map(id=>players.find(p=>p.id===id)).filter(Boolean)as Player[],out:string[]=[];for(const[g,n]of[["F",3],["D",2],["G",1]]as const){const candidates=chosen.filter(p=>group(p)===g),pref=candidates.filter(p=>preferred.includes(p.id));out.push(...[...pref,...candidates.filter(p=>!preferred.includes(p.id))].slice(0,n).map(p=>p.id))}return out}
function validLine1(ids:string[],players:Player[]){const chosen=ids.map(id=>players.find(p=>p.id===id)).filter(Boolean)as Player[];return ids.length===6&&new Set(ids).size===6&&chosen.filter(p=>group(p)==="F").length===3&&chosen.filter(p=>p.position==="D").length===2&&chosen.filter(p=>p.position==="G").length===1}
function formationClass(player:Card,index:number){const g=group(player);if(g==="G")return styles.g;if(g==="D")return index===0?styles.d1:styles.d2;return index===0?styles.f1:index===1?styles.f2:styles.f3}

export default function HomeFantasyLineup({teamId}:{teamId:string|null}){
 const[line,setLine]=useState<1|2>(1),[cards,setCards]=useState<Card[]>([]),[loading,setLoading]=useState(Boolean(teamId));
 useEffect(()=>{if(!teamId){setCards([]);setLoading(false);return}(async()=>{setLoading(true);try{const sb=getSupabaseBrowserClient();if(!sb)return;const{data:tp}=await sb.from("fantasy_user_team_players").select("player_id,line_no,is_captain,is_vice_captain").eq("team_id",teamId);const rows=(tp||[])as TeamPlayer[],ids=rows.map(r=>r.player_id);if(!ids.length){setCards([]);return}const[{data:p},{data:prices}]=await Promise.all([sb.from("fantasy_players").select("id,name,team,position").in("id",ids),sb.from("fantasy_player_season_prices").select("player_id,price").eq("season",SEASON).in("player_id",ids)]);const players=(p||[])as Player[],priceRows=(prices||[])as PriceRow[];const explicitLine1=rows.filter(r=>Number(r.line_no)===1).map(r=>r.player_id);const line1Ids=validLine1(explicitLine1,players)?explicitLine1:buildLine1(ids,players,explicitLine1);const line1Set=new Set(line1Ids),priceMap=new Map<string,number>(priceRows.map(x=>[String(x.player_id),Number(x.price)||0])),meta=new Map<string,TeamPlayer>(rows.map(r=>[r.player_id,r]));setCards(players.map((player):Card=>{const m=meta.get(player.id);return{...player,lineNo:line1Set.has(player.id)?1:2,price:priceMap.get(player.id)||0,captain:Boolean(m?.is_captain),vice:Boolean(m?.is_vice_captain)}}).sort(sortFormation))}finally{setLoading(false)}})()},[teamId]);
 const line1=useMemo(()=>cards.filter(p=>p.lineNo===1).sort(sortFormation),[cards]);
 const line2=useMemo(()=>cards.filter(p=>p.lineNo===2).sort(sortFormation),[cards]);
 const visible=line===1?line1:line2;
 const positioned=useMemo(()=>{const counters:Record<PositionGroup,number>={F:0,D:0,G:0};return visible.map(player=>{const g=group(player),slot=formationClass(player,counters[g]);counters[g]+=1;return{player,slot}})},[visible]);
 if(!teamId)return <div className={styles.empty}><strong>Opprett Fantasy-laget ditt</strong><span>Spillerne vises her når laget er lagret.</span></div>;
 if(loading)return <div className={styles.empty}><strong>Laster lagoppstilling …</strong></div>;
 return <div className={styles.wrap}><div className={styles.tabs} role="tablist" aria-label="Velg rekke"><button type="button" role="tab" aria-selected={line===1} className={line===1?styles.active:""} onClick={()=>setLine(1)}>1. rekke</button><button type="button" role="tab" aria-selected={line===2} className={line===2?styles.active:""} onClick={()=>setLine(2)}>2. rekke</button></div><div className={styles.rink} aria-label={`${line}. rekke`}><div className={`${styles.blueLine} ${styles.blueLeft}`}/><div className={`${styles.blueLine} ${styles.blueRight}`}/><div className={styles.centerCircle}/><div className={styles.crease}/>{positioned.map(({player,slot})=><a href={`/fantasy/players/${player.id}`} className={`${styles.card} ${slot}`} key={player.id}><span className={styles.jersey}><span className={styles.jerseyMark}>{group(player)}</span>{player.captain&&<b className={styles.badge}>C</b>}{player.vice&&<b className={styles.badge}>VC</b>}</span><span className={styles.name}><strong>{player.name}</strong><small>{player.team} · {player.price.toFixed(1)}m</small></span></a>)}</div></div>;
}
