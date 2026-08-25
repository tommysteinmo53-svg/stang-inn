"use client";

import { usePathname } from "next/navigation";
import SIIcon,{type SIIconName} from "./SIIcon";

const items:{href:string;icon:SIIconName;label:string;match:(p:string)=>boolean}[] = [
  { href: "/", icon: "home", label: "Hjem", match: (p: string) => p === "/" },
  { href: "/fantasy", icon: "fantasy", label: "Fantasy", match: (p: string) => (p === "/fantasy" || p.startsWith("/fantasy/")) && !p.startsWith("/fantasy/rules") },
  { href: "/tips", icon: "tips", label: "Tipping", match: (p: string) => p.startsWith("/tips") || p.startsWith("/round") || p.startsWith("/tabletips") || p.startsWith("/match/") || p.startsWith("/leaderboard") || p.startsWith("/awards") || p.startsWith("/player/") },
  { href: "/live", icon: "live", label: "Live", match: (p: string) => p.startsWith("/live") },
  { href: "/leagues", icon: "leagues", label: "Miniligaer", match: (p: string) => p.startsWith("/leagues") },
  { href: "/fantasy/rules", icon: "rules", label: "Regler", match: (p: string) => p.startsWith("/fantasy/rules") },
  { href: "/profile", icon: "menu", label: "Mer", match: (p: string) => p.startsWith("/profile") || p.startsWith("/admin") || p.startsWith("/notifications") },
];

export default function GlobalMobileNav() {
  const pathname = usePathname();
  return <nav className="globalMobileNav" aria-label="Hovedmeny">{items.map(item=>{const active=item.match(pathname);return <a key={item.href} href={item.href} className={`${active?"active":""} ${item.href==="/live"?"mobileLiveNav":""}`.trim()} aria-current={active?"page":undefined}><span aria-hidden><SIIcon name={item.icon} size={19}/></span><small>{item.label}</small></a>})}</nav>;
}
