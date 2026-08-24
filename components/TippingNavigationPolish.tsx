"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function applyLabels() {
  const navButtons = document.querySelectorAll<HTMLButtonElement>("main.appShell .desktopTabs button");
  navButtons.forEach(button => {
    if (button.textContent?.trim() === "Statistikk") button.textContent = "Tabell";
  });

  document.querySelectorAll<HTMLButtonElement>("main.appShell button.textButton").forEach(button => {
    if (button.textContent?.trim() === "Se statistikk →") button.textContent = "Se tabell →";
  });
}

export default function TippingNavigationPolish() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;

    applyLabels();
    const observer = new MutationObserver(applyLabels);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const timer = window.setTimeout(applyLabels, 100);

    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [pathname]);

  return null;
}
