# Backtesting engine: technical spec

Source: [`src/lib/backtest.ts`](../src/lib/backtest.ts) · API: `POST /api/strategies/backtest`

## Strategy model

Long-only **SMA crossover** with protective exits. Rules (`trading_strategies.rules`):

| Field | Type | Range | Meaning |
| --- | --- | --- | --- |
| `fastPeriod` | int | 2–100 | fast simple moving average, must be `< slowPeriod` |
| `slowPeriod` | int | 3–300 | slow simple moving average |
| `stopLossPct` | number | 0.5–50 | exit when price trades this % below entry |
| `takeProfitPct` | number | 0.5–200 | exit when price trades this % above entry |
| `initialCapital` | number | > 0 | defaults to 10,000 |

Validated by the `StrategyRules` Zod schema on both the API route and the
`saveStrategy` server action.

## Simulation loop (daily bars, oldest → newest)

For each bar `i`:

1. **Fill queued orders at `open[i]`.** Queued exits fill first, then queued entries.
   Entries buy fractional shares with all available cash.
2. **Protective exits (intrabar).** With an open position:
   - `low[i] ≤ stop` → exit at `min(open[i], stop)`. A gap down through the stop fills at the open, not the stop.
   - else `high[i] ≥ target` → exit at `max(open[i], target)`.
   - When a bar touches both, the **stop wins**. Without intraday data we can't
     know the order, so we take the conservative assumption.
3. **Signals on `close[i]`.**
   - Flat, and `fast[i-1] ≤ slow[i-1]` and `fast[i] > slow[i]` → queue entry.
   - Long, and `fast[i-1] ≥ slow[i-1]` and `fast[i] < slow[i]` → queue exit.
4. **Mark to market.** Equity = `shares × close[i]` (or cash when flat).

A position still open on the last bar is closed at that bar's close (`end_of_data`).

Because signals use the close of bar `i` and fill at the open of bar `i+1`,
there is **no look-ahead bias**.

## Outputs (`trading_strategies.backtest_results`)

| Field | Definition |
| --- | --- |
| `totalReturnPct` | `(finalEquity − initialCapital) / initialCapital` |
| `buyAndHoldReturnPct` | `(lastClose − firstClose) / firstClose` over the same window |
| `winRatePct` | share of trades with `returnPct > 0` |
| `maxDrawdownPct` | largest peak-to-trough fall of the equity curve |
| `trades[]` | entry/exit date & price, `returnPct`, `reason` (`signal` · `stop_loss` · `take_profit` · `end_of_data`) |

`equityCurve` is returned to the client for charting but not persisted.

## Known limitations

- No fees, slippage, dividends, splits (prices are Yahoo's split-adjusted closes), or shorting.
- Daily bars only; stop/target ordering within a bar is assumed.
- One position at a time, fully invested.

## Extending

Add new entry rules by extending `StrategyRules` with a discriminated union
(e.g. `{ kind: "rsi", period, oversold }`) and branching in step 3. Everything
else (fills, exits, stats) is rule-agnostic.
