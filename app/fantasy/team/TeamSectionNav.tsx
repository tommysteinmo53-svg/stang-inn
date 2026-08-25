"use client";

import {usePathname} from "next/navigation";
import "./team-section-nav.css";

export default function TeamSectionNav(){
 const pathname=usePathname();
 const event=pathname==="/fantasy/event-team"||pathname.startsWith("/fantasy/event-team/");
 const transfers=pathname==="/fantasy/transfers"||pathname.startsWith("/fantasy/transfers/");
 return <div className="team-section-nav-wrap"><nav className="team-section-nav" aria-label="Lag">
  <a href="/fantasy/team" className={!event&&!transfers?"active":""} aria-current={!event&&!transfers?"page":undefined}>Mitt lag</a>
  <a href="/fantasy/event-team" className={event?"active":""} aria-current={event?"page":undefined}>Eventlag</a>
  <a href="/fantasy/transfers" className={transfers?"active":""} aria-current={transfers?"page":undefined}>Bytter</a>
 </nav></div>;
}
