import "./globals.css";
import "bootstrap/dist/css/bootstrap.min.css";

export const metadata = {
  title: "Track Your Best",
  description: "The best tracking system that you can use!",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning={true}>
        {/*
          AuthProvider is temporarily disabled while login/auth is turned off.
          Re-enable when auth flow is needed again.
        */}
        {children}
      </body>
    </html>
  );
}
