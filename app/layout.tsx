import "./globals.css";
import AuthGate from "../components/AuthGate";
import SystemStatus from "../components/SystemStatus";

export const metadata = {
  title: "Stang Inn",
  description: "Privat tippeapp for norsk hockey",
};

const quickLinkStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 11px",
  borderRadius: 999,
  background: "rgba(8,23,41,.94)",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 900,
  boxShadow: "0 8px 24px rgba(0,0,0,.25)",
} as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no">
      <body>
        <AuthGate>{children}</AuthGate>
        <div
          style={{
            position: "fixed",
            right: 14,
            top: 14,
            zIndex: 80,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "flex-end",
            maxWidth: "calc(100vw - 28px)",
          }}
        >
          <a href="/tips" aria-label="Åpne tipssiden" style={{ ...quickLinkStyle, border: "1px solid rgba(245,196,81,.32)", color: "#f8d982" }}>✍️ Tips</a>
          <a href="/round" aria-label="Åpne rundeoversikten" style={{ ...quickLinkStyle, border: "1px solid rgba(180,140,255,.35)", color: "#cfb6ff" }}>📋 Runde</a>
          <a href="/leaderboard" aria-label="Åpne sammenlagt-tabellen" style={{ ...quickLinkStyle, border: "1px solid rgba(85,184,255,.32)", color: "#9fd7ff" }}>🏆 Tabell</a>
          <a href="/live" aria-label="Åpne live-tabellen" style={{ ...quickLinkStyle, border: "1px solid rgba(79,214,156,.32)", color: "#8ff0c5" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4fd69c" }} />Live
          </a>
        </div>
        <SystemStatus />
      </body>
    </html>
  );
}
