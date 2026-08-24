"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import PremiumNextMatch from "./PremiumNextMatch";

export default function HomeRoundPortal() {
  const pathname = usePathname();
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (pathname !== "/") {
      setTarget(null);
      return;
    }

    const host = document.createElement("div");
    host.className = "premiumRoundPortalHost";

    const placeHost = () => {
      const nav = document.querySelector<HTMLElement>("main.appShell .desktopTabs");
      if (!nav) return false;
      if (!host.isConnected || nav.nextElementSibling !== host) {
        nav.insertAdjacentElement("afterend", host);
      }
      setTarget(host);
      return true;
    };

    placeHost();
    const observer = new MutationObserver(() => placeHost());
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = window.setTimeout(placeHost, 100);

    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
      setTarget(null);
      host.remove();
    };
  }, [pathname]);

  if (pathname !== "/" || !target) return null;
  return createPortal(<PremiumNextMatch />, target);
}
