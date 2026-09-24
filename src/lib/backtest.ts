import { z } from "zod";
import type { Candle } from "./market";

export const StrategyRules = z
  .object({
    /** Enter long when the fast SMA crosses above the slow SMA; exit on the cross back down. */
    fastPeriod: z.number().int().min(2).max(100),
    slowPeriod: z.number().int().min(3).max(300),
    /** Exit if price falls this % below entry (checked against the day's low). */
    stopLossPct: z.number().min(0.5).max(50),
    /** Exit if price rises this % above entry (checked against the day's high). */
    takeProfitPct: z.number().min(0.5).max(200),
    initialCapital: z.number().positive().max(1e9).default(10_000),
  })
  .refine((r) => r.fastPeriod < r.slowPeriod, { message: "fastPeriod must be less than slowPeriod" });

export type StrategyRules = z.infer<typeof StrategyRules>;

export interface Trade {
  entryDate: string;
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  returnPct: number;
  reason: "signal" | "stop_loss" | "take_profit" | "end_of_data";
}

export interface BacktestResult {
  trades: Trade[];
  totalReturnPct: number;
  buyAndHoldReturnPct: number;
  winRatePct: number;
  maxDrawdownPct: number;
  finalEquity: number;
  equityCurve: { time: string; value: number }[];
}

export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Long-only SMA crossover with stop loss / take profit. Signals are computed on a
 * day's close and filled at the next day's open, so there is no look-ahead bias.
 * If a day's range hits both the stop and the target, the stop is assumed first.
 */
export function runBacktest(candles: Candle[], rules: StrategyRules): BacktestResult {
  const closes = candles.map((c) => c.close);
  const fast = sma(closes, rules.fastPeriod);
  const slow = sma(closes, rules.slowPeriod);

  const trades: Trade[] = [];
  const equityCurve: BacktestResult["equityCurve"] = [];
  let cash = rules.initialCapital;
  let position: { entryPrice: number; entryDate: string; shares: number } | null = null;
  let pendingEntry = false;
  let pendingExit = false;

  const close = (i: number, price: number, reason: Trade["reason"]) => {
    const p = position!;
    cash = p.shares * price;
    trades.push({
      entryDate: p.entryDate,
      entryPrice: round(p.entryPrice),
      exitDate: candles[i].time,
      exitPrice: round(price),
      returnPct: round(((price - p.entryPrice) / p.entryPrice) * 100),
      reason,
    });
    position = null;
  };

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];

    // Fill orders queued at yesterday's close.
    if (pendingExit && position) close(i, c.open, "signal");
    if (pendingEntry && !position) {
      position = { entryPrice: c.open, entryDate: c.time, shares: cash / c.open };
      cash = 0;
    }
    pendingEntry = pendingExit = false;

    if (position) {
      const stop = position.entryPrice * (1 - rules.stopLossPct / 100);
      const target = position.entryPrice * (1 + rules.takeProfitPct / 100);
      if (c.low <= stop) close(i, Math.min(c.open, stop), "stop_loss");
      else if (c.high >= target) close(i, Math.max(c.open, target), "take_profit");
    }

    const [f, s, pf, ps] = [fast[i], slow[i], fast[i - 1], slow[i - 1]];
    if (f != null && s != null && pf != null && ps != null) {
      if (!position && pf <= ps && f > s) pendingEntry = true;
      if (position && pf >= ps && f < s) pendingExit = true;
    }

    equityCurve.push({ time: c.time, value: round(position ? position.shares * c.close : cash) });
  }

  if (position) close(candles.length - 1, candles[candles.length - 1].close, "end_of_data");

  let peak = -Infinity;
  let maxDrawdown = 0;
  for (const { value } of equityCurve) {
    peak = Math.max(peak, value);
    maxDrawdown = Math.max(maxDrawdown, (peak - value) / peak);
  }

  const wins = trades.filter((t) => t.returnPct > 0).length;
  const first = candles[0]?.close ?? 0;
  const last = candles.at(-1)?.close ?? 0;

  return {
    trades,
    totalReturnPct: round(((cash - rules.initialCapital) / rules.initialCapital) * 100),
    buyAndHoldReturnPct: first ? round(((last - first) / first) * 100) : 0,
    winRatePct: trades.length ? round((wins / trades.length) * 100) : 0,
    maxDrawdownPct: round(maxDrawdown * 100),
    finalEquity: round(cash),
    equityCurve,
  };
}
