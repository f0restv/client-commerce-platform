import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CollektIQ - Know What It's Worth",
  description: "AI-powered collectibles pricing. Scan any coin, card, or collectible to get instant market values. Trusted by collectors worldwide.",
  keywords: ["collectibles", "coins", "trading cards", "pokemon", "sports cards", "pricing", "AI", "grading", "PCGS", "NGC", "PSA"],
  authors: [{ name: "CollektIQ" }],
  openGraph: {
    title: "CollektIQ - Know What It's Worth",
    description: "AI-powered collectibles pricing. Scan any coin, card, or collectible to get instant market values.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "CollektIQ - Know What It's Worth",
    description: "AI-powered collectibles pricing. Scan any coin, card, or collectible to get instant market values.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
