"use client";

import {usePathname} from "next/navigation";

const items=[
 {href:"/fantasy/play",label:"Oversikt",icon:"🏒"},
 {href:"/fantasy/team",label:"Mitt lag",icon:"👥"},
 {href:"/fantasy/my-rounds",label:"Poeng",icon:"📊"},
 {href:"/fantasy/leaderboard",label:"Leaderboard",icon:"🏆"},
 {href:"/fantasy/achievements",label:"Achievements",icon:"🔥"},
 {href:"/fantasy/rounds",label:"Runder",icon:"📅"},
 {href:"/fantasy/rules",label:"Regler",icon:"📖"},
];

const productionPrefixes=["/fantasy/play","/fantasy/team","/fantasy/my-rounds","/fantasy/leaderboard","/fantasy/achievements","/fantasy/rounds","/fantasy/rules"];

export default function FantasyNav(){
 const pathname=usePathname();
 if(!productionPrefixes.some(p=>pathname===p||pathname.startsWith(`${p}/`)))return null;
 return <div className="fantasy-player-nav-wrap"><nav className="fantasy-player-nav" aria-label="Fantasy-meny">
  {items.map(item=>{const active=pathname===item.href||pathname.startsWith(`${item.href}/`);return <a key={item.href} href={item.href} className={active?"active":""} aria-current={active?"page":undefined}><span aria-hidden>{item.icon}</span><b>{item.label}</b></a>})}
 </nav></div>
}
