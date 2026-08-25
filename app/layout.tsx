import "./globals.css";
import "./navigation.css";
import "./premium-polish.css";
import "./premium-next-match.css";
import "./round-carousel.css";
import "./awards.css";
import "./leaderboard.css";
import "./leaderboard-premium.css";
import "./tips-polish.css";
import "./tabletips-polish.css";
import "./player-profile-polish.css";
import "./shared-leagues.css";
import "./league-owner-controls.css";
import "./game-mode-switch.css";
import "./stang-inn-brand.css";
import "./unified-home.css";
import "./unified-home-finish.css";
import "./tipping-premium.css";
import "./tipping-layout.css";
import "./tipping-layout-fixes.css";
import "./tipping-final-polish.css";
import "./match-detail-premium.css";
import "./account-premium.css";
import "./account-final-polish.css";
import "./admin-surface.css";
import AuthGate from "../components/AuthGate";
import AuthReturnRedirect from "../components/AuthReturnRedirect";
import AnnouncementBanner from "../components/AnnouncementBanner";
import GlobalMobileNav from "../components/GlobalMobileNav";
import HomeRoundPortal from "../components/HomeRoundPortal";
import TippingNavigationPolish from "../components/TippingNavigationPolish";
import StangInnHeader from "../components/StangInnHeader";
import UnifiedHomeDashboard from "../components/UnifiedHomeDashboard";
import AdminSurfaceMode from "../components/AdminSurfaceMode";
import TippingSurfaceMode from "../components/TippingSurfaceMode";

export const metadata = {
  title: {
    default: "Stang Inn – Tipping & Fantasy",
    template: "%s | Stang Inn",
  },
  description: "Stang Inn samler norsk hockey, tipping, EHL Fantasy, miniligaer og statistikk på ett sted.",
  icons: {
    icon: "/stang-inn-mark.svg",
    shortcut: "/stang-inn-mark.svg",
    apple: "/stang-inn-mark.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no">
      <body>
        <AdminSurfaceMode />
        <TippingSurfaceMode />
        <AuthReturnRedirect />
        <AuthGate>
          <StangInnHeader />
          <UnifiedHomeDashboard />
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
