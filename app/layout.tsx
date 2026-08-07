import "./globals.css";
import "./navigation.css";
import "./premium-polish.css";
import AuthGate from "../components/AuthGate";
import AnnouncementBanner from "../components/AnnouncementBanner";
import GlobalMobileNav from "../components/GlobalMobileNav";
import PremiumPolish from "../components/PremiumPolish";
import TopStatusBar from "../components/TopStatusBar";

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
        <TopStatusBar />
        <GlobalMobileNav />
      </body>
    </html>
  );
}
