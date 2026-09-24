import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Candle, Headline } from "./market";

export const StockAnalysis = z.object({
  sentiment: z.enum(["BULLISH", "BEARISH", "NEUTRAL"]),
  sentimentScore: z.number().describe("From -1.00 (very bearish) to +1.00 (very bullish)"),
  impactScore: z.number().describe("0-100: how much the news flow is likely to move the price"),
  summary: z.string().describe("3-5 sentence plain-English summary of what is driving the stock"),
  keyDrivers: z.array(z.string()).describe("Up to 5 short phrases"),
  keyRisks: z.array(z.string()).describe("Up to 5 short phrases"),
  recommendedStrategy: z
    .string()
    .describe("A short, educational description of how a trader might approach this setup"),
  citedHeadlines: z.array(z.number().int()).describe("Indexes of the headlines the summary relies on"),
});

export type StockAnalysis = z.infer<typeof StockAnalysis>;

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5";

// Kept byte-stable so it can be prompt-cached across tickers.
const SYSTEM = `You are MarketIQ's equity news analyst. You receive a ticker, a price snapshot and recent headlines.
Assess the sentiment the headlines imply for the stock over the next few weeks, weighing source credibility and recency.
Base every claim on the supplied data; if the headlines are thin or irrelevant, say so and lean NEUTRAL with a low impact score.
Keep keyDrivers and keyRisks to short phrases. recommendedStrategy is educational, not personalised financial advice.`;

let client: Anthropic | null = null;

export class AnalysisRefusedError extends Error {}

export async function analyzeStock(input: {
  ticker: string;
  name: string;
  candles: Candle[];
  headlines: Headline[];
}): Promise<StockAnalysis> {
  client ??= new Anthropic();

  const recent = input.candles.slice(-60);
  const last = recent.at(-1);
  const first = recent[0];
  const snapshot = last && first
    ? {
        lastClose: last.close,
        date: last.time,
        change60dPct: +(((last.close - first.close) / first.close) * 100).toFixed(2),
        high60d: Math.max(...recent.map((c) => c.high)),
        low60d: Math.min(...recent.map((c) => c.low)),
      }
    : null;

  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          ticker: input.ticker,
          company: input.name,
          priceSnapshot: snapshot,
          headlines: input.headlines.map((h, i) => ({ index: i, ...h })),
        }),
      },
    ],
    output_config: { format: betaZodOutputFormat(StockAnalysis) },
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new AnalysisRefusedError(`Analysis unavailable (stop_reason: ${response.stop_reason})`);
  }

  const a = response.parsed_output;
  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
  return {
    ...a,
    sentimentScore: +clamp(a.sentimentScore, -1, 1).toFixed(2),
    impactScore: Math.round(clamp(a.impactScore, 0, 100)),
    keyDrivers: a.keyDrivers.slice(0, 5),
    keyRisks: a.keyRisks.slice(0, 5),
    citedHeadlines: a.citedHeadlines.filter((i) => i >= 0 && i < input.headlines.length),
  };
}
