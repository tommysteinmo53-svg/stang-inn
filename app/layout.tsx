import "./globals.css";
import "./navigation.css";
import "./premium-polish.css";
import "./premium-next-match.css";
import "./round-carousel.css";
import "./home-live-table.css";
import "./awards.css";
import AuthGate from "../components/AuthGate";
import AuthReturnRedirect from "../components/AuthReturnRedirect";
import AnnouncementBanner from "../components/AnnouncementBanner";
import GlobalMobileNav from "../components/GlobalMobileNav";
import TopStatusBar from "../components/TopStatusBar";
import PremiumNextMatch from "../components/PremiumNextMatch";
import HomeLiveTable from "../components/HomeLiveTable";

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
