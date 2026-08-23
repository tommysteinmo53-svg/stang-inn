"use client";

import {usePathname} from "next/navigation";
import TeamLaunchStatus from "./team/TeamLaunchStatus";
import TeamSectionNav from "./team/TeamSectionNav";
import PlayerProfileClickBridge from "./PlayerProfileClickBridge";

const items=[
 {href:"/fantasy",label:"Oversikt",icon:"🏒"},
 {href:"/fantasy/team",label:"Mitt lag",icon:"👥"},
 {href:"/fantasy/transfers",label:"Bytter",icon:"🔁"},
 {href:"/fantasy/players",label:"Spillere",icon:"🧍"},
 {href:"/fantasy/my-rounds",label:"Poeng",icon:"📊"},
 {href:"/fantasy/leaderboard",label:"Leaderboard",icon:"🏆"},
 {href:"/fantasy/leagues",label:"Ligaer",icon:"🤝"},
 {href:"/fantasy/achievements",label:"Achievements",icon:"🔥"},
 {href:"/fantasy/rounds",label:"Runder",icon:"📅"},
 {href:"/fantasy/rules",label:"Regler",icon:"📖"},
];

const productionPrefixes=["/fantasy","/fantasy/team","/fantasy/transfers","/fantasy/event-team","/fantasy/players","/fantasy/my-rounds","/fantasy/stats","/fantasy/leaderboard","/fantasy/leagues","/fantasy/achievements","/fantasy/rounds","/fantasy/rules"];
const hiddenPrefixes=["/fantasy/admin-tools","/fantasy/admin-analysis","/fantasy/diagnose","/fantasy/scoring","/fantasy/special-teams-diagnostic"];

export default function FantasyNav(){
 const pathname=usePathname();
 if(hiddenPrefixes.some(p=>pathname===p||pathname.startsWith(`${p}/`)))return null;
 if(!productionPrefixes.some(p=>pathname===p||pathname.startsWith(`${p}/`)))return null;
 const teamSection=pathname==="/fantasy/team"||pathname.startsWith("/fantasy/team/")||pathname==="/fantasy/event-team"||pathname.startsWith("/fantasy/event-team/");
 return <><PlayerProfileClickBridge/><div className="fantasy-player-nav-wrap"><nav className="fantasy-player-nav" aria-label="Fantasy-meny">
  {items.map(item=>{const active=item.href==="/fantasy"?pathname==="/fantasy":item.href==="/fantasy/team"?(pathname===item.href||pathname.startsWith(`${item.href}/`)||pathname==="/fantasy/event-team"||pathname.startsWith("/fantasy/event-team/")):item.href==="/fantasy/my-rounds"?(pathname===item.href||pathname.startsWith(`${item.href}/`)||pathname==="/fantasy/stats"||pathname.startsWith("/fantasy/stats/")):(pathname===item.href||pathname.startsWith(`${item.href}/`));return <a key={item.href} href={item.href} className={active?"active":""} aria-current={active?"page":undefined}><span aria-hidden>{item.icon}</span><b>{item.label}</b></a>})}
 </nav></div>{teamSection&&<TeamSectionNav/>}{pathname==="/fantasy/team"&&<div className="team-launch-wrap"><TeamLaunchStatus/></div>}</>
}
