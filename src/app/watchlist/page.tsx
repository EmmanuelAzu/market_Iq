import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getQuote } from "@/lib/market";
import { formatPct, formatPrice } from "@/lib/market-shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default async function WatchlistPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/watchlist");

  const [{ data: items }, { data: strategies }] = await Promise.all([
    supabase.from("watchlists").select("ticker, company_name").order("added_at", { ascending: false }),
    supabase
      .from("trading_strategies")
      .select("id, title, ticker, description, backtest_results, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const quotes = await Promise.all((items ?? []).map((i) => getQuote(i.ticker).catch(() => null)));

  return (
    <main className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_380px]">
      <section>
        <h1 className="mb-6 text-2xl font-bold">Watchlist</h1>
        {!items?.length ? (
          <p className="text-muted-foreground">Search for a ticker and press “Add to watchlist”.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {items.map((item, i) => {
              const q = quotes[i];
              const up = (q?.changePercent ?? 0) >= 0;
              return (
                <li key={item.ticker}>
                  <Link href={`/stocks/${item.ticker}`} className="flex items-center gap-4 px-4 py-3 hover:bg-muted">
                    <span className="w-20 font-mono font-semibold">{item.ticker}</span>
                    <span className="flex-1 truncate text-sm text-muted-foreground">{item.company_name}</span>
                    <span className="tabular-nums">{formatPrice(q?.price, q?.currency)}</span>
                    <span className={cn("w-20 text-right text-sm tabular-nums", up ? "text-positive" : "text-negative")}>
                      {formatPct(q?.changePercent)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <aside>
        <Card>
          <CardHeader>
            <CardTitle>Saved strategies</CardTitle>
          </CardHeader>
          <CardContent>
            {!strategies?.length ? (
              <p className="text-sm text-muted-foreground">Run a backtest on any stock page and save it here.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {strategies.map((s) => {
                  const r = s.backtest_results as { totalReturnPct?: number } | null;
                  return (
                    <li key={s.id}>
                      <Link href={`/stocks/${s.ticker}`} className="font-medium hover:text-primary">
                        {s.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {s.description}
                        {r?.totalReturnPct != null && ` · ${formatPct(r.totalReturnPct)}`}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </aside>
    </main>
  );
}
