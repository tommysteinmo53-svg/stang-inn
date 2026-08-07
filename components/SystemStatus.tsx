"use client";

import { useEffect, useState } from "react";

type StatusPayload = {
  app: string;
  version: string;
  commit: string;
  environment: string;
  deploymentId: string | null;
  buildTime: string | null;
  provider: string;
  services: Record<string, { ok: boolean; detail: string }>;
};

function Dot({ ok }: { ok: boolean }) {
  return <span aria-hidden style={{ display: "inline-block", width: 8, height: 8, borderRadius: 99, background: ok ? "#4fd69c" : "#ff7b8c", marginRight: 7 }} />;
}

export default function SystemStatus() {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [open, setOpen] = useState(false);
  const [clicks, setClicks] = useState(0);

  useEffect(() => {
    fetch("/api/system-status", { cache: "no-store" })
      .then((response) => response.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  function toggle() {
    setClicks((value) => value + 1);
    setOpen(true);
  }

  const commit = data?.commit || "…";
  const version = data?.version || "0.7.0";

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        title="Åpne systemstatus"
        style={{
          position: "fixed",
          left: 12,
          bottom: 12,
          zIndex: 80,
          border: "1px solid #223a5d",
          borderRadius: 12,
          padding: "8px 10px",
          background: "rgba(8,20,37,.94)",
          color: "#dbe8f8",
          fontSize: 11,
          fontWeight: 800,
          boxShadow: "0 10px 28px rgba(0,0,0,.28)",
        }}
      >
        🏒 Stang Inn · v{version} · {commit}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Systemstatus"
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(2,8,15,.72)", display: "grid", placeItems: "center", padding: 18 }}
        >
          <section
            onClick={(event) => event.stopPropagation()}
            style={{ width: "min(520px, 100%)", maxHeight: "82vh", overflow: "auto", borderRadius: 20, padding: 22, background: "#0e1b2f", color: "#f4f8ff", border: "1px solid #31547d", boxShadow: "0 28px 80px rgba(0,0,0,.5)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
              <div>
                <div style={{ color: "#55b8ff", textTransform: "uppercase", letterSpacing: ".12em", fontSize: 11, fontWeight: 900 }}>Utviklerpanel</div>
                <h2 style={{ margin: "6px 0 4px" }}>Stang Inn systemstatus</h2>
                <p style={{ color: "#96a9c5", margin: 0, fontSize: 13 }}>Trygt diagnosepanel uten hemmelige nøkler.</p>
              </div>
              <button onClick={() => setOpen(false)} style={{ border: 0, borderRadius: 10, padding: "7px 10px", background: "#142640", color: "white" }}>✕</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 18 }}>
              {[
                ["Versjon", `v${version}`],
                ["Commit", commit],
                ["Miljø", data?.environment || "…"],
                ["Provider", data?.provider || "HockeyLive"],
              ].map(([label, value]) => (
                <div key={label} style={{ border: "1px solid #223a5d", borderRadius: 12, padding: 12, background: "#0a1729" }}>
                  <span style={{ display: "block", color: "#96a9c5", fontSize: 11 }}>{label}</span>
                  <strong style={{ display: "block", marginTop: 4 }}>{value}</strong>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 18, borderTop: "1px solid #223a5d", paddingTop: 14 }}>
              {data ? Object.entries(data.services).map(([name, service]) => (
                <div key={name} style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "10px 0", borderBottom: "1px solid rgba(34,58,93,.55)" }}>
                  <strong style={{ textTransform: "capitalize" }}><Dot ok={service.ok} />{name}</strong>
                  <span style={{ color: "#96a9c5", textAlign: "right", fontSize: 12 }}>{service.detail}</span>
                </div>
              )) : <p style={{ color: "#96a9c5" }}>Laster status …</p>}
            </div>

            {clicks >= 5 && (
              <div style={{ marginTop: 18, padding: 14, borderRadius: 12, border: "1px solid rgba(245,196,81,.35)", background: "rgba(245,196,81,.08)" }}>
                <strong style={{ color: "#f5c451" }}>🛠 Developer mode aktiv</strong>
                <p style={{ color: "#c9d6e8", fontSize: 12, margin: "6px 0 0" }}>Fem klikk er registrert. Vi kan senere legge inn provider-test, loggvisning og cache-verktøy her.</p>
              </div>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 18 }}>
              <a href="/admin" style={{ textDecoration: "none", padding: "9px 12px", borderRadius: 10, background: "#55b8ff", color: "#06101d", fontWeight: 900 }}>Åpne Admin</a>
              <button onClick={() => window.location.reload()} style={{ border: "1px solid #223a5d", padding: "9px 12px", borderRadius: 10, background: "#142640", color: "#f4f8ff", fontWeight: 800 }}>Oppdater app</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
