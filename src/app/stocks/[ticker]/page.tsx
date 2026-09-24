import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getDailyCandles, getQuote, normalizeTicker } from "@/lib/market";
import { formatPct, formatPrice } from "@/lib/market-shared";
import { isAnnotationList } from "@/lib/annotations";
import { cn } from "@/lib/utils";
import { StockChart } from "@/components/chart/stock-chart";
import { InsightPanel } from "@/components/insights/insight-panel";
import { BacktestPanel } from "@/components/insights/backtest-panel";
import { WatchButton } from "@/components/watch-button";

export default async function StockPage({ params }: { params: Promise<{ ticker: string }> }) {
  const ticker = normalizeTicker((await params).ticker);
  if (!ticker) notFound();

  const [quote, candles] = await Promise.all([getQuote(ticker).catch(() => null), getDailyCandles(ticker).catch(() => [])]);
  if (!quote || candles.length === 0) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let annotations: unknown = [];
  let watching = false;
  if (user) {
    const [ann, watch] = await Promise.all([
      supabase.from("chart_annotations").select("annotation_data").eq("ticker", ticker).maybeSingle(),
      supabase.from("watchlists").select("id").eq("ticker", ticker).maybeSingle(),
    ]);
    annotations = ann.data?.annotation_data ?? [];
    watching = !!watch.data;
  }

  const up = (quote.change ?? 0) >= 0;

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {quote.name} · {quote.exchange}
          </p>
          <h1 className="flex items-baseline gap-3">
            <span className="font-mono text-3xl font-bold">{ticker}</span>
            <span className="text-3xl font-semibold tabular-nums">{formatPrice(quote.price, quote.currency)}</span>
            <span className={cn("text-lg font-medium tabular-nums", up ? "text-positive" : "text-negative")}>
              {up ? "+" : ""}
              {formatPrice(quote.change, quote.currency)} ({formatPct(quote.changePercent)})
            </span>
          </h1>
        </div>
        {user && <WatchButton ticker={ticker} name={quote.name} watching={watching} />}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <StockChart
          ticker={ticker}
          candles={candles}
          initialAnnotations={isAnnotationList(annotations) ? annotations : []}
          signedIn={!!user}
        />
        <InsightPanel ticker={ticker} signedIn={!!user} />
      </div>

      <BacktestPanel ticker={ticker} signedIn={!!user} />
    </main>
  );
}
