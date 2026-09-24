import { NextResponse } from "next/server";
import { z } from "zod";
import { runBacktest, StrategyRules } from "@/lib/backtest";
import { getDailyCandles, normalizeTicker } from "@/lib/market";

const Body = z.object({
  ticker: z.string(),
  rules: StrategyRules,
  days: z.number().int().min(90).max(3650).default(730),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid strategy", issues: parsed.error.issues }, { status: 422 });
  }
  const ticker = normalizeTicker(parsed.data.ticker);
  if (!ticker) return NextResponse.json({ error: "Invalid ticker" }, { status: 422 });

  let candles;
  try {
    candles = await getDailyCandles(ticker, parsed.data.days);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Market data unavailable" }, { status: 502 });
  }
  if (candles.length < parsed.data.rules.slowPeriod + 2) {
    return NextResponse.json({ error: "Not enough price history for these periods" }, { status: 422 });
  }

  return NextResponse.json({ ticker, from: candles[0].time, to: candles.at(-1)!.time, ...runBacktest(candles, parsed.data.rules) });
}
