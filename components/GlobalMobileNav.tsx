"use client";

import { usePathname } from "next/navigation";

const items = [
  { href: "/", icon: "⌂", label: "Hjem", match: (p: string) => p === "/" },
  { href: "/fantasy", icon: "◇", label: "Fantasy", match: (p: string) => p === "/fantasy" || p.startsWith("/fantasy/") },
  { href: "/tips", icon: "○", label: "Tipping", match: (p: string) => p.startsWith("/tips") || p.startsWith("/round") || p.startsWith("/tabletips") || p.startsWith("/match/") },
  { href: "/leagues", icon: "♙", label: "Miniligaer", match: (p: string) => p.startsWith("/leagues") },
  { href: "/profile", icon: "≡", label: "Mer", match: (p: string) => p.startsWith("/profile") || p.startsWith("/admin") || p.startsWith("/leaderboard") || p.startsWith("/awards") || p.startsWith("/notifications") },
];

export default function GlobalMobileNav() {
  const pathname = usePathname();
  return (
    <nav className="globalMobileNav" aria-label="Hovedmeny">
      {items.map(item => {
        const active = item.match(pathname);
        return (
          <a key={item.href} href={item.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
            <span aria-hidden>{item.icon}</span>
            <small>{item.label}</small>
          </a>
        );
      })}
    </nav>
  );
}
