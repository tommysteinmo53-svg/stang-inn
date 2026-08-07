import "./globals.css";
import AuthGate from "../components/AuthGate";

export const metadata = {
  title: "Stang Inn",
  description: "Privat tippeapp for norsk hockey",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no">
      <body><AuthGate>{children}</AuthGate></body>
    </html>
  );
}
