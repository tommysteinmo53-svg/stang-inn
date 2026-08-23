"use client";

import {usePathname} from "next/navigation";
import "./points-section.css";

const tabs=[
 {href:"/fantasy/my-rounds",label:"Rundehistorikk",icon:"📊"},
 {href:"/fantasy/stats",label:"Min statistikk",icon:"📈"},
];

export default function PointsSectionNav(){
 const pathname=usePathname();
 return <nav className="points-section-nav" aria-label="Poeng og statistikk">
  {tabs.map(tab=>{const active=pathname===tab.href||pathname.startsWith(`${tab.href}/`);return <a key={tab.href} href={tab.href} className={active?"active":""} aria-current={active?"page":undefined}><span aria-hidden>{tab.icon}</span><b>{tab.label}</b></a>})}
 </nav>;
}
