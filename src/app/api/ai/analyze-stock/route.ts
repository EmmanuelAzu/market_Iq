import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { AnalysisRefusedError, analyzeStock, type StockAnalysis } from "@/lib/ai";
import { getDailyCandles, getHeadlines, getQuote, normalizeTicker } from "@/lib/market";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const Body = z.object({ ticker: z.string(), refresh: z.boolean().default(false) });

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Model calls cost money; require an account.
  if (!user) return NextResponse.json({ error: "Sign in to use AI insights" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  const ticker = parsed.success ? normalizeTicker(parsed.data.ticker) : null;
  if (!parsed.success || !ticker) return NextResponse.json({ error: "Invalid ticker" }, { status: 422 });

  if (!parsed.data.refresh) {
    const { data: cached } = await supabase
      .from("ai_insights_cache")
      .select("analysis, news_references, created_at, expires_at")
      .eq("ticker", ticker)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cached?.analysis) {
      return NextResponse.json({
        ticker,
        analysis: cached.analysis as StockAnalysis,
        headlines: cached.news_references,
        generatedAt: cached.created_at,
        cached: true,
      });
    }
  }

  // Fetch headlines server-side rather than trusting client-supplied news.
  let quote, candles, headlines;
  try {
    [quote, candles, headlines] = await Promise.all([getQuote(ticker), getDailyCandles(ticker, 120), getHeadlines(ticker)]);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Market data unavailable" }, { status: 502 });
  }
  if (!quote) return NextResponse.json({ error: "Unknown ticker" }, { status: 404 });

  let analysis: StockAnalysis;
  try {
    analysis = await analyzeStock({ ticker, name: quote.name, candles, headlines });
  } catch (err) {
    if (err instanceof AnalysisRefusedError) {
      return NextResponse.json({ error: "The model declined to analyse this request" }, { status: 422 });
    }
    console.error(err);
    return NextResponse.json({ error: "AI analysis failed. Try again shortly." }, { status: 502 });
  }

  const generatedAt = new Date().toISOString();
  const admin = createAdminClient();
  if (admin) {
    const { error } = await admin.from("ai_insights_cache").insert({
      ticker,
      sentiment_score: analysis.sentimentScore,
      summary: analysis.summary,
      key_drivers: analysis.keyDrivers,
      news_references: headlines,
      analysis,
      expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
    });
    if (error) console.error("insight cache write failed", error);
  }

  return NextResponse.json({ ticker, analysis, headlines, generatedAt, cached: false });
}
