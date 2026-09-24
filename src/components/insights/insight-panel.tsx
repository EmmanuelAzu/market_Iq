"use client";

import { useState } from "react";
import Link from "next/link";
import { RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { StockAnalysis } from "@/lib/ai";
import type { Headline } from "@/lib/market";

interface InsightResponse {
  analysis: StockAnalysis;
  headlines: Headline[];
  generatedAt: string;
  cached: boolean;
}

const TONE = {
  BULLISH: "bg-positive/10 text-positive",
  BEARISH: "bg-negative/10 text-negative",
  NEUTRAL: "bg-muted text-muted-foreground",
};

export function InsightPanel({ ticker, signedIn }: { ticker: string; signedIn: boolean }) {
  const [data, setData] = useState<InsightResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function analyze(refresh = false) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ai/analyze-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, refresh }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Analysis failed");
      setData(json);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const a = data?.analysis;
  // Map -1..1 to 0..100% for the gauge marker.
  const gauge = a ? ((a.sentimentScore + 1) / 2) * 100 : 50;

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" /> AI insight
        </CardTitle>
        <CardDescription>News sentiment and drivers, summarised by Claude.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {!signedIn ? (
          <p>
            <Link href={`/login?next=/stocks/${ticker}`} className="text-primary underline">
              Sign in
            </Link>{" "}
            to generate AI insights.
          </p>
        ) : !a ? (
          <Button onClick={() => analyze()} disabled={loading}>
            <Sparkles /> {loading ? "Reading the news…" : `Analyse ${ticker}`}
          </Button>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", TONE[a.sentiment])}>{a.sentiment}</span>
              <span className="text-xs text-muted-foreground">Impact {a.impactScore}/100</span>
            </div>
            <div>
              <div className="relative h-2 rounded-full bg-gradient-to-r from-negative via-slate-300 to-positive">
                <span
                  className="absolute -top-1 size-4 -translate-x-1/2 rounded-full border-2 border-white bg-foreground shadow"
                  style={{ left: `${gauge}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                <span>Bearish</span>
                <span>{a.sentimentScore.toFixed(2)}</span>
                <span>Bullish</span>
              </div>
            </div>
            <p className="leading-relaxed">{a.summary}</p>
            <List title="Key drivers" items={a.keyDrivers} dot="bg-positive" />
            <List title="Key risks" items={a.keyRisks} dot="bg-negative" />
            <div>
              <h3 className="mb-1 font-semibold">Strategy idea</h3>
              <p className="text-muted-foreground">{a.recommendedStrategy}</p>
            </div>
            {a.citedHeadlines.length > 0 && (
              <div>
                <h3 className="mb-1 font-semibold">Sources</h3>
                <ul className="space-y-1">
                  {a.citedHeadlines.map((i) => {
                    const h = data!.headlines[i];
                    return (
                      h && (
                        <li key={i}>
                          <a href={h.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            {h.title}
                          </a>{" "}
                          <span className="text-xs text-muted-foreground">· {h.publisher}</span>
                        </li>
                      )
                    );
                  })}
                </ul>
              </div>
            )}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {data!.cached ? "Cached · " : ""}
                {new Date(data!.generatedAt).toLocaleString()}
              </span>
              <Button size="sm" variant="ghost" onClick={() => analyze(true)} disabled={loading}>
                <RefreshCw className={loading ? "animate-spin" : ""} /> Refresh
              </Button>
            </div>
          </>
        )}
        {error && <p className="text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

function List({ title, items, dot }: { title: string; items: string[]; dot: string }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="mb-1 font-semibold">{title}</h3>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", dot)} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
