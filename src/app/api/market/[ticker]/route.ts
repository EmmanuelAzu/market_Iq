import { NextResponse } from "next/server";
import { getDailyCandles, getQuote, normalizeTicker } from "@/lib/market";

export async function GET(_req: Request, { params }: { params: Promise<{ ticker: string }> }) {
  const ticker = normalizeTicker((await params).ticker);
  if (!ticker) return NextResponse.json({ error: "Invalid ticker" }, { status: 400 });

  try {
    const [quote, candles] = await Promise.all([getQuote(ticker), getDailyCandles(ticker)]);
    if (!quote) return NextResponse.json({ error: "Unknown ticker" }, { status: 404 });
    return NextResponse.json(
      { quote, candles },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Market data unavailable" }, { status: 502 });
  }
}
