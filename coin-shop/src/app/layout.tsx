import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Header, Footer, CartDrawer } from '@/components/layout';
import { MetalsTicker } from '@/components/shop';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CoinVault | Premium Coins & Collectibles',
  description: 'Your trusted source for rare coins, bullion, and numismatic collectibles. Buy, sell, and consign with confidence.',
  keywords: ['coins', 'collectibles', 'bullion', 'gold', 'silver', 'numismatic', 'rare coins'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen flex flex-col">
          <MetalsTicker />
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
        <CartDrawer />
      </body>
    </html>
  );
}
