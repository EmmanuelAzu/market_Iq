"use client";

import { useState, useTransition } from "react";
import { FlaskConical, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatPct } from "@/lib/market-shared";
import type { BacktestResult } from "@/lib/backtest";
import { saveStrategy } from "@/app/actions";
import { EquityChart } from "./equity-chart";

type Result = BacktestResult & { from: string; to: string };

const FIELDS = [
  { key: "fastPeriod", label: "Fast SMA", step: 1 },
  { key: "slowPeriod", label: "Slow SMA", step: 1 },
  { key: "stopLossPct", label: "Stop loss %", step: 0.5 },
  { key: "takeProfitPct", label: "Take profit %", step: 0.5 },
] as const;

type Rules = Record<(typeof FIELDS)[number]["key"], number>;

export function BacktestPanel({ ticker, signedIn }: { ticker: string; signedIn: boolean }) {
  const [rules, setRules] = useState<Rules>({ fastPeriod: 20, slowPeriod: 50, stopLossPct: 8, takeProfitPct: 20 });
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [title, setTitle] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [saving, startSaving] = useTransition();

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setRunning(true);
    setError("");
    setSaveStatus("");
    try {
      const res = await fetch("/api/strategies/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, rules }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.issues?.[0]?.message ?? json.error ?? "Backtest failed");
      setResult(json);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  }

  function save() {
    if (!result) return;
    const { equityCurve: _curve, ...summary } = result;
    void _curve;
    startSaving(async () => {
      try {
        await saveStrategy({ title: title || `${ticker} SMA ${rules.fastPeriod}/${rules.slowPeriod}`, ticker, rules, results: summary });
        setSaveStatus("Saved to your strategies");
      } catch (err) {
        setSaveStatus((err as Error).message);
      }
    });
  }

  const stats = result && [
    ["Strategy return", formatPct(result.totalReturnPct), result.totalReturnPct >= 0],
    ["Buy & hold", formatPct(result.buyAndHoldReturnPct), result.buyAndHoldReturnPct >= 0],
    ["Win rate", `${result.winRatePct.toFixed(0)}%`, null],
    ["Max drawdown", `-${result.maxDrawdownPct.toFixed(2)}%`, false],
    ["Trades", String(result.trades.length), null],
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="size-4 text-primary" /> Strategy backtest
        </CardTitle>
        <CardDescription>
          Long when the fast SMA crosses above the slow SMA, exit on the cross back, the stop loss or the take profit.
          Orders fill at the next day&apos;s open.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <form onSubmit={run} className="flex flex-wrap items-end gap-3">
          {FIELDS.map((f) => (
            <label key={f.key} className="flex flex-col gap-1 text-xs text-muted-foreground">
              {f.label}
              <Input
                type="number"
                step={f.step}
                min={f.step}
                className="w-28"
                value={rules[f.key]}
                onChange={(e) => setRules((r) => ({ ...r, [f.key]: Number(e.target.value) }))}
              />
            </label>
          ))}
          <Button type="submit" disabled={running}>
            {running ? "Running…" : "Run backtest"}
          </Button>
          {error && <p className="w-full text-sm text-destructive">{error}</p>}
        </form>

        {result && stats && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {stats.map(([label, value, positive]) => (
                <div key={label} className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p
                    className={cn(
                      "text-lg font-semibold tabular-nums",
                      positive === true && "text-positive",
                      positive === false && "text-negative",
                    )}
                  >
                    {value}
                  </p>
                </div>
              ))}
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">
                Equity curve · {result.from} → {result.to}
              </p>
              <EquityChart data={result.equityCurve} />
            </div>
            {result.trades.length > 0 && (
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="py-1 font-medium">Entry</th>
                      <th className="font-medium">Exit</th>
                      <th className="font-medium">Reason</th>
                      <th className="text-right font-medium">Return</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {result.trades.map((t) => (
                      <tr key={t.entryDate} className="border-t border-border">
                        <td className="py-1">
                          {t.entryDate} @ {t.entryPrice}
                        </td>
                        <td>
                          {t.exitDate} @ {t.exitPrice}
                        </td>
                        <td className="text-muted-foreground">{t.reason.replace(/_/g, " ")}</td>
                        <td className={cn("text-right", t.returnPct >= 0 ? "text-positive" : "text-negative")}>
                          {formatPct(t.returnPct)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {signedIn && (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  className="max-w-xs"
                  placeholder={`${ticker} SMA ${rules.fastPeriod}/${rules.slowPeriod}`}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  aria-label="Strategy name"
                />
                <Button variant="outline" onClick={save} disabled={saving}>
                  <Save /> Save strategy
                </Button>
                {saveStatus && <span className="text-sm text-muted-foreground">{saveStatus}</span>}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Past performance doesn&apos;t predict future results. Ignores fees, slippage and dividends.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
