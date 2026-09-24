// Drawings are stored in data space (date, price) so they stay anchored
// when the chart is zoomed, panned or resized.

export interface ChartPoint {
  time: string; // YYYY-MM-DD, snapped to a candle
  price: number;
}

export type Annotation =
  | { id: string; type: "trendline"; a: ChartPoint; b: ChartPoint }
  | { id: string; type: "fibonacci"; a: ChartPoint; b: ChartPoint }
  | { id: string; type: "hline"; price: number }
  | { id: string; type: "note"; at: ChartPoint; text: string };

export type Tool = "cursor" | "trendline" | "hline" | "fibonacci" | "note" | "eraser";

export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

export function isAnnotationList(value: unknown): value is Annotation[] {
  return Array.isArray(value) && value.every((a) => a && typeof a === "object" && "type" in a && "id" in a);
}
