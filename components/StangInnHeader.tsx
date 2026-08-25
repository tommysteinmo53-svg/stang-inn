"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import SIIcon from "./SIIcon";

const nav = [
  { href: "/", label: "Hjem", active: (p: string) => p === "/" },
  { href: "/fantasy", label: "Fantasy", active: (p: string) => p === "/fantasy" || p.startsWith("/fantasy/") },
  { href: "/tips", label: "Tipping", active: (p: string) => p.startsWith("/tips") || p.startsWith("/round") || p.startsWith("/tabletips") || p.startsWith("/match/") || p.startsWith("/leaderboard") || p.startsWith("/awards") || p.startsWith("/player/") },
  { href: "/live", label: "Live", active: (p: string) => p.startsWith("/live") },
  { href: "/leagues", label: "Miniligaer", active: (p: string) => p.startsWith("/leagues") },
  { href: "/fantasy/rules", label: "Regler", active: (p: string) => p.startsWith("/fantasy/rules") },
];

export default function StangInnHeader() {
  const pathname = usePathname();
  const [commit, setCommit] = useState("…");

  useEffect(() => {
    fetch("/api/system-status", { cache: "no-store" })
      .then(r => r.json())
      .then(data => setCommit(data?.commit || "…"))
      .catch(() => setCommit("…"));
  }, []);

  if (pathname === "/login") return null;

  return <header className="siHeader"><div className="siHeaderInner">
    <a className="siBrand" href="/" aria-label="Stang Inn – hjem"><img src="/stang-inn-mark.svg" alt="" width="54" height="41"/><span className="siWordmark"><strong>STANG INN</strong><small>TIPPING &amp; FANTASY</small></span></a>
    <nav className="siDesktopNav" aria-label="Stang Inn hovedmeny">{nav.map(item=>{const active=item.active(pathname);return <a key={item.href} href={item.href} className={`${active?"active":""} ${item.href==="/live"?"siLiveNavLink":""}`.trim()} aria-current={active?"page":undefined}>{item.href==="/live"&&<span className="siLiveNavDot" aria-hidden/>}{item.label}</a>})}</nav>
    <div className="siHeaderActions"><span className="siBuildCommit" title="Aktiv commit">main · {commit}</span><a href="/notifications" className="siIconAction" aria-label="Varsler"><SIIcon name="bell" size={18}/></a><a href="/profile" className="siProfileAction" aria-label="Profil"><span>Profil</span></a></div>
  </div></header>;
}
