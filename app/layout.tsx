import "./globals.css";
import "./navigation.css";
import "./premium-polish.css";
import "./premium-next-match.css";
import "./round-carousel.css";
import "./home-live-table.css";
import "./awards.css";
import "./game-mode-switch.css";
import AuthGate from "../components/AuthGate";
import AuthReturnRedirect from "../components/AuthReturnRedirect";
import AnnouncementBanner from "../components/AnnouncementBanner";
import GlobalMobileNav from "../components/GlobalMobileNav";
import TopStatusBar from "../components/TopStatusBar";
import PremiumNextMatch from "../components/PremiumNextMatch";
import HomeLiveTable from "../components/HomeLiveTable";
import GameModeSwitch from "../components/GameModeSwitch";
import HockeytipsLeagueShortcut from "../components/HockeytipsLeagueShortcut";

export const metadata = {
  title: "Stang Inn",
  description: "Privat tippeapp for norsk hockey",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no">
      <body>
        <AuthReturnRedirect />
        <TopStatusBar />
        <AuthGate>
          <GameModeSwitch />
          <HockeytipsLeagueShortcut />
          <PremiumNextMatch />
          <HomeLiveTable />
          {children}
        </AuthGate>
        <AnnouncementBanner />
        <GlobalMobileNav />
      </body>
    </html>
  );
}
