import "./globals.css";
import "./navigation.css";
import "./premium-polish.css";
import "./premium-next-match.css";
import "./round-carousel.css";
import "./awards.css";
import "./game-mode-switch.css";
import AuthGate from "../components/AuthGate";
import AuthReturnRedirect from "../components/AuthReturnRedirect";
import AnnouncementBanner from "../components/AnnouncementBanner";
import GlobalMobileNav from "../components/GlobalMobileNav";
import TopStatusBar from "../components/TopStatusBar";
import HomeRoundPortal from "../components/HomeRoundPortal";
import TippingNavigationPolish from "../components/TippingNavigationPolish";
import GameModeSwitch from "../components/GameModeSwitch";

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
          <HomeRoundPortal />
          <TippingNavigationPolish />
          {children}
        </AuthGate>
        <AnnouncementBanner />
        <GlobalMobileNav />
      </body>
    </html>
  );
}
