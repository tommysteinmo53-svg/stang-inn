"use client";

import {usePathname} from "next/navigation";
import SIIcon,{type SIIconName} from "../../components/SIIcon";
import TeamLaunchStatus from "./team/TeamLaunchStatus";
import TeamSectionNav from "./team/TeamSectionNav";
import PlayerProfileClickBridge from "./PlayerProfileClickBridge";

const items:{href:string;label:string;icon:SIIconName}[]=[
 {href:"/fantasy",label:"Oversikt",icon:"overview"},
 {href:"/fantasy/team",label:"Mitt lag",icon:"team"},
 {href:"/fantasy/players",label:"Spillere",icon:"player"},
 {href:"/fantasy/my-rounds",label:"Poeng",icon:"stats"},
 {href:"/fantasy/leaderboard",label:"Leaderboard",icon:"trophy"},
 {href:"/fantasy/leagues",label:"Ligaer",icon:"leagues"},
 {href:"/fantasy/rounds",label:"Runder",icon:"calendar"},
 {href:"/fantasy/rules",label:"Regler",icon:"rules"},
];

const productionPrefixes=["/fantasy","/fantasy/team","/fantasy/transfers","/fantasy/event-team","/fantasy/players","/fantasy/my-rounds","/fantasy/stats","/fantasy/leaderboard","/fantasy/leagues","/fantasy/achievements","/fantasy/rounds","/fantasy/rules"];
const hiddenPrefixes=["/fantasy/admin-tools","/fantasy/admin-analysis","/fantasy/diagnose","/fantasy/scoring","/fantasy/special-teams-diagnostic"];

export default function FantasyNav(){
 const pathname=usePathname();
 if(hiddenPrefixes.some(p=>pathname===p||pathname.startsWith(`${p}/`)))return null;
 if(!productionPrefixes.some(p=>pathname===p||pathname.startsWith(`${p}/`)))return null;
 const teamSection=pathname==="/fantasy/team"||pathname.startsWith("/fantasy/team/")||pathname==="/fantasy/event-team"||pathname.startsWith("/fantasy/event-team/")||pathname==="/fantasy/transfers"||pathname.startsWith("/fantasy/transfers/");
 return <><PlayerProfileClickBridge/><div className="fantasy-player-nav-wrap"><nav className="fantasy-player-nav" aria-label="Fantasy-meny">
  {items.map(item=>{const active=item.href==="/fantasy"?pathname==="/fantasy":item.href==="/fantasy/team"?(pathname===item.href||pathname.startsWith(`${item.href}/`)||pathname==="/fantasy/event-team"||pathname.startsWith("/fantasy/event-team/")||pathname==="/fantasy/transfers"||pathname.startsWith("/fantasy/transfers/")):item.href==="/fantasy/my-rounds"?(pathname===item.href||pathname.startsWith(`${item.href}/`)||pathname==="/fantasy/stats"||pathname.startsWith("/fantasy/stats/")):item.href==="/fantasy/leaderboard"?(pathname===item.href||pathname.startsWith(`${item.href}/`)||pathname==="/fantasy/achievements"||pathname.startsWith("/fantasy/achievements/")):(pathname===item.href||pathname.startsWith(`${item.href}/`));return <a key={item.href} href={item.href} className={active?"active":""} aria-current={active?"page":undefined}><span aria-hidden><SIIcon name={item.icon} size={18}/></span><b>{item.label}</b></a>})}
 </nav></div>{teamSection&&<TeamSectionNav/>}{pathname==="/fantasy/team"&&<div className="team-launch-wrap"><TeamLaunchStatus/></div>}</>
}
