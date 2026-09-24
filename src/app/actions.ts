"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { StrategyRules, type BacktestResult } from "@/lib/backtest";
import { TICKER_RE } from "@/lib/market-shared";
import type { Annotation } from "@/lib/annotations";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in first");
  return { supabase, user };
}

function checkTicker(ticker: string) {
  if (!TICKER_RE.test(ticker)) throw new Error("Invalid ticker");
}

export async function toggleWatchlist(ticker: string, companyName: string, watching: boolean) {
  checkTicker(ticker);
  const { supabase, user } = await requireUser();
  if (watching) {
    await supabase.from("watchlists").delete().eq("user_id", user.id).eq("ticker", ticker);
  } else {
    await supabase.from("watchlists").upsert(
      { user_id: user.id, ticker, company_name: companyName },
      { onConflict: "user_id,ticker", ignoreDuplicates: true },
    );
  }
  revalidatePath("/watchlist");
  revalidatePath(`/stocks/${ticker}`);
}

export async function saveAnnotations(ticker: string, annotations: Annotation[]) {
  checkTicker(ticker);
  if (annotations.length > 500) throw new Error("Too many drawings");
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("chart_annotations").upsert(
    { user_id: user.id, ticker, annotation_data: annotations, updated_at: new Date().toISOString() },
    { onConflict: "user_id,ticker" },
  );
  if (error) throw new Error("Could not save drawings");
}

export async function saveStrategy(input: {
  title: string;
  ticker: string;
  rules: unknown;
  results: Omit<BacktestResult, "equityCurve">;
}) {
  checkTicker(input.ticker);
  const rules = StrategyRules.parse(input.rules);
  const title = input.title.trim().slice(0, 120);
  if (!title) throw new Error("Give the strategy a name");
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("trading_strategies").insert({
    user_id: user.id,
    title,
    ticker: input.ticker,
    description: `SMA ${rules.fastPeriod}/${rules.slowPeriod} crossover, SL ${rules.stopLossPct}%, TP ${rules.takeProfitPct}%`,
    rules,
    backtest_results: input.results,
  });
  if (error) throw new Error("Could not save strategy");
  revalidatePath("/watchlist");
}
