"use client";

import {usePathname} from "next/navigation";
import "./team-section-nav.css";

export default function TeamSectionNav(){
 const pathname=usePathname();
 const event=pathname==="/fantasy/event-team"||pathname.startsWith("/fantasy/event-team/");
 return <nav className="team-section-nav" aria-label="Lag">
  <a href="/fantasy/team" className={!event?"active":""} aria-current={!event?"page":undefined}>👥 Mitt lag</a>
  <a href="/fantasy/event-team" className={event?"active":""} aria-current={event?"page":undefined}>🎯 Eventlag</a>
 </nav>;
}
