import "./globals.css";
import "./navigation.css";
import "./premium-polish.css";
import AuthGate from "../components/AuthGate";
import AnnouncementBanner from "../components/AnnouncementBanner";
import NotificationBell from "../components/NotificationBell";
import GlobalMobileNav from "../components/GlobalMobileNav";
import PremiumPolish from "../components/PremiumPolish";
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
        <AnnouncementBanner />
        <PremiumPolish />
        <SystemStatus />
        <NotificationBell />
        <GlobalMobileNav />
      </body>
    </html>
  );
}
