import "./globals.css";
import "./navigation.css";
import AuthGate from "../components/AuthGate";
import AnnouncementBanner from "../components/AnnouncementBanner";
import NotificationBell from "../components/NotificationBell";
import GlobalMobileNav from "../components/GlobalMobileNav";

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
        <NotificationBell />
        <GlobalMobileNav />
      </body>
    </html>
  );
}
