import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
// import { PrivyProvider } from "@privy-io/react-auth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Perp Markets",
  description: "Perpetual Markets with Privy Wallet Integration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* <PrivyProvider
          appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ""}
          config={{
            loginMethods: ["email", "wallet", "sms", "google", "apple", "twitter", "discord", "github", "tiktok", "linkedin", "farcaster"],
            appearance: {
              theme: "light",
              accentColor: "#676FFF",
              logo: "https://your-logo-url.com/logo.png",
            },
            embeddedWallets: {
              createOnLogin: "users-without-wallets",
            },
          }}
        > */}
          {children}
        {/* </PrivyProvider> */}
      </body>
    </html>
  );
}
