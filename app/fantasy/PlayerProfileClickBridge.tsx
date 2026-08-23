"use client";

import {useEffect} from "react";
import {getSupabaseBrowserClient} from "../../lib/supabase";

type PlayerRef={id:string;name:string;team:string;position:string};

export default function PlayerProfileClickBridge(){
 useEffect(()=>{
  let players:PlayerRef[]=[];
  let alive=true;
  const s=getSupabaseBrowserClient();
  if(s)s.from("fantasy_players").select("id,name,team,position").then(({data})=>{if(alive)players=(data||[]) as PlayerRef[]});

  const handler=(event:MouseEvent)=>{
   const target=event.target as HTMLElement|null;
   if(!target)return;
   const nameNode=target.closest(".team-market-player strong,.event-pool-row .event-player-meta b,.event-roster-row .event-player-meta b");
   if(!nameNode)return;
   const row=nameNode.closest(".team-market-player,.event-pool-row,.event-roster-row") as HTMLElement|null;
   if(!row)return;
   const name=(nameNode.textContent||"").trim();
   const meta=(row.querySelector("small")?.textContent||"").trim();
   const candidates=players.filter(p=>p.name===name);
   let player=candidates[0];
   if(candidates.length>1){
    player=candidates.find(p=>meta.includes(p.team)&&meta.includes(p.position))||candidates.find(p=>meta.includes(p.team))||candidates[0];
   }
   if(!player)return;
   event.preventDefault();
   event.stopPropagation();
   window.location.assign(`/fantasy/players/${player.id}`);
  };
  document.addEventListener("click",handler,true);
  return()=>{alive=false;document.removeEventListener("click",handler,true)};
 },[]);
 return null;
}
