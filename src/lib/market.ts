import "server-only";
import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

import { TICKER_RE } from "./market-shared";

export { TICKER_RE };

export function normalizeTicker(raw: string) {
  const t = decodeURIComponent(raw).trim().toUpperCase();
  return TICKER_RE.test(t) ? t : null;
}

export interface Candle {
  time: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Headline {
  title: string;
  publisher: string;
  link: string;
  publishedAt: string;
}

export async function getQuote(ticker: string) {
  const q = await yf.quote(ticker);
  if (!q) return null;
  return {
    ticker: q.symbol,
    name: q.longName ?? q.shortName ?? q.symbol,
    price: q.regularMarketPrice ?? null,
    change: q.regularMarketChange ?? null,
    changePercent: q.regularMarketChangePercent ?? null,
    currency: q.currency ?? "USD",
    marketCap: q.marketCap ?? null,
    exchange: q.fullExchangeName ?? q.exchange ?? null,
  };
}

/** Daily candles, oldest first. */
export async function getDailyCandles(ticker: string, days = 730): Promise<Candle[]> {
  const result = await yf.chart(ticker, {
    period1: new Date(Date.now() - days * 86_400_000),
    interval: "1d",
  });
  return result.quotes
    .filter((q) => q.open != null && q.high != null && q.low != null && q.close != null)
    .map((q) => ({
      time: q.date.toISOString().slice(0, 10),
      open: q.open!,
      high: q.high!,
      low: q.low!,
      close: q.close!,
      volume: q.volume ?? 0,
    }));
}

export async function getHeadlines(ticker: string, count = 12): Promise<Headline[]> {
  const result = await yf.search(ticker, { newsCount: count, quotesCount: 0 });
  return result.news.map((n) => ({
    title: n.title,
    publisher: n.publisher,
    link: n.link,
    publishedAt: new Date(n.providerPublishTime).toISOString(),
  }));
}

export async function searchSymbols(query: string) {
  const result = await yf.search(query, { quotesCount: 8, newsCount: 0 });
  return result.quotes
    .filter((q): q is typeof q & { symbol: string } => "symbol" in q && typeof q.symbol === "string")
    .map((q) => ({
      ticker: q.symbol,
      name: ("longname" in q && q.longname) || ("shortname" in q && q.shortname) || q.symbol,
    }));
}
