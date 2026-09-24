import Image from "next/image";
import Link from "next/link";
import { BrainCircuit, CandlestickChart, FlaskConical } from "lucide-react";
import { TickerSearch } from "@/components/ticker-search";

const POPULAR = ["AAPL", "NVDA", "MSFT", "TSLA", "AMZN", "GOOGL"];

const FEATURES = [
  { icon: CandlestickChart, title: "Draw on real charts", body: "Trendlines, Fibonacci retracements and notes that stay anchored as you zoom." },
  { icon: BrainCircuit, title: "AI news sentiment", body: "Claude reads the latest headlines and summarises drivers, risks and sentiment." },
  { icon: FlaskConical, title: "Backtest ideas", body: "Test SMA crossover rules with stop losses and take profits against years of data." },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-20">
      <section className="flex flex-col items-center gap-6 text-center">
        <Image src="/logo.svg" alt="MarketIQ logo" width={80} height={80} priority />
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Research stocks with an <span className="text-primary">AI analyst</span> at your side
        </h1>
        <div className="w-full max-w-md">
          <TickerSearch autoFocus />
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {POPULAR.map((t) => (
            <Link
              key={t}
              href={`/stocks/${t}`}
              className="rounded-full border border-border px-3 py-1 font-mono text-sm hover:border-primary hover:text-primary"
            >
              {t}
            </Link>
          ))}
        </div>
      </section>
      <section className="mt-20 grid gap-6 sm:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-xl border border-border bg-card p-6">
            <Icon className="mb-3 size-6 text-primary" />
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
