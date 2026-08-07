import "./globals.css";
import AuthGate from "../components/AuthGate";
import SystemStatus from "../components/SystemStatus";

export const metadata = {
  title: "Stang Inn",
  description: "Privat tippeapp for norsk hockey",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no">
      <body>
        <AuthGate>{children}</AuthGate>
        <a
          href="/live"
          aria-label="Åpne live-tabellen"
          style={{
            position: "fixed",
            right: 14,
            top: 14,
            zIndex: 80,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 11px",
            borderRadius: 999,
            border: "1px solid rgba(79,214,156,.32)",
            background: "rgba(8,23,41,.94)",
            color: "#8ff0c5",
            textDecoration: "none",
            fontSize: 12,
            fontWeight: 900,
            boxShadow: "0 8px 24px rgba(0,0,0,.25)",
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4fd69c" }} />
          Live
        </a>
        <SystemStatus />
      </body>
    </html>
  );
}
