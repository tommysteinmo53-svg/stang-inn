import "./globals.css";
import "./navigation.css";
import "./premium-polish.css";
import "./premium-next-match.css";
import "./round-carousel.css";
import AuthGate from "../components/AuthGate";
import AnnouncementBanner from "../components/AnnouncementBanner";
import GlobalMobileNav from "../components/GlobalMobileNav";
import PremiumPolish from "../components/PremiumPolish";
import TopStatusBar from "../components/TopStatusBar";
import PremiumNextMatch from "../components/PremiumNextMatch";

export const metadata = {
  title: "Stang Inn",
  description: "Privat tippeapp for norsk hockey",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no">
      <body>
        <TopStatusBar />
        <AuthGate>
          <PremiumNextMatch />
          {children}
        </AuthGate>
        <AnnouncementBanner />
        <PremiumPolish />
        <GlobalMobileNav />
      </body>
    </html>
  );
}
