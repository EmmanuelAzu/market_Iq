import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { TickerSearch } from "@/components/ticker-search";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MarketIQ",
  description: "AI-powered stock research: interactive charts, news sentiment and strategy backtesting.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <header className="border-b border-border">
          <nav className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <Image src="/logo.svg" alt="" width={28} height={28} />
              Market<span className="text-primary">IQ</span>
            </Link>
            <div className="ml-auto w-full max-w-xs">
              <TickerSearch />
            </div>
            <Link href="/watchlist" className="text-sm text-muted-foreground hover:text-foreground">
              Watchlist
            </Link>
          </nav>
        </header>
        {children}
        <footer className="mx-auto max-w-7xl px-4 py-8 text-xs text-muted-foreground">
          Market data from Yahoo Finance may be delayed. AI insights are for education only and are not financial
          advice.
        </footer>
      </body>
    </html>
  );
}
