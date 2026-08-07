import "./globals.css";

export const metadata = {
  title: "Stang Inn",
  description: "Privat tippeapp for norsk hockey",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no">
      <body>{children}</body>
    </html>
  );
}
