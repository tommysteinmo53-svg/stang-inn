import "./globals.css";
import AuthGate from "../components/AuthGate";
import SystemStatus from "../components/SystemStatus";
import AdminShortcut from "../components/AdminShortcut";
import AnnouncementBanner from "../components/AnnouncementBanner";
import NotificationBell from "../components/NotificationBell";

export const metadata = {
  title: "Stang Inn",
  description: "Privat tippeapp for norsk hockey",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no">
      <body>
        <AuthGate>{children}</AuthGate>
        <AnnouncementBanner />
        <nav className="globalQuickNav" aria-label="Hurtignavigasjon">
          <a href="/tips" className="globalNavChip tipsChip">✍️ <span>Tips</span></a>
          <a href="/round" className="globalNavChip roundChip">📋 <span>Runde</span></a>
          <a href="/leaderboard" className="globalNavChip tableChip">🏆 <span>Tabell</span></a>
          <a href="/live" className="globalNavChip liveChip"><i className="liveDot" /> <span>Live</span></a>
        </nav>
        <NotificationBell />
        <AdminShortcut />
        <SystemStatus />
      </body>
    </html>
  );
}
