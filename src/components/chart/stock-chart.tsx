"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";
import { Eraser, Minus, MousePointer2, Save, Slash, StickyNote, Trash2, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sma } from "@/lib/backtest";
import { FIB_LEVELS, type Annotation, type ChartPoint, type Tool } from "@/lib/annotations";
import type { Candle } from "@/lib/market";
import { saveAnnotations } from "@/app/actions";

const BLUE = "#2563EB";
const UP = "#10B981";
const DOWN = "#EF4444";

const TOOLS: { id: Tool; label: string; icon: typeof Slash }[] = [
  { id: "cursor", label: "Pan & zoom", icon: MousePointer2 },
  { id: "trendline", label: "Trendline", icon: Slash },
  { id: "hline", label: "Horizontal line", icon: Minus },
  { id: "fibonacci", label: "Fibonacci retracement", icon: Waves },
  { id: "note", label: "Text note", icon: StickyNote },
  { id: "eraser", label: "Erase drawing", icon: Eraser },
];

function timeToString(t: Time): string {
  if (typeof t === "string") return t;
  if (typeof t === "number") return new Date(t * 1000).toISOString().slice(0, 10);
  return `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;
}

function distanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len)) : 0;
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export function StockChart({
  ticker,
  candles,
  initialAnnotations,
  signedIn,
}: {
  ticker: string;
  candles: Candle[];
  initialAnnotations: Annotation[];
  signedIn: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const smaRefs = useRef<Record<"20" | "50", ISeriesApi<"Line"> | null>>({ "20": null, "50": null });
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  const [tool, setTool] = useState<Tool>("cursor");
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations);
  const [draft, setDraft] = useState<{ a: ChartPoint; b: ChartPoint } | null>(null);
  const [indicators, setIndicators] = useState({ "20": true, "50": false, volume: true });
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState("");
  const [saving, startSaving] = useTransition();

  // ---- chart setup -------------------------------------------------------
  useEffect(() => {
    const el = containerRef.current!;
    const chart = createChart(el, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "#FFFFFF" }, textColor: "#475569", fontSize: 12 },
      grid: { vertLines: { color: "#F1F5F9" }, horzLines: { color: "#F1F5F9" } },
      rightPriceScale: { borderColor: "#E2E8F0" },
      timeScale: { borderColor: "#E2E8F0" },
      crosshair: { mode: 0 },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      borderVisible: false,
      wickUpColor: UP,
      wickDownColor: DOWN,
    });
    series.setData(candles.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })));

    const volume = chart.addSeries(HistogramSeries, { priceScaleId: "volume", priceFormat: { type: "volume" } });
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    volume.setData(
      candles.map((c) => ({ time: c.time, value: c.volume, color: c.close >= c.open ? "#10B98155" : "#EF444455" })),
    );

    const closes = candles.map((c) => c.close);
    for (const [period, color] of [["20", BLUE], ["50", "#F59E0B"]] as const) {
      const line = chart.addSeries(LineSeries, {
        color,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      const values = sma(closes, Number(period));
      line.setData(candles.flatMap((c, i) => (values[i] == null ? [] : [{ time: c.time, value: values[i]! }])));
      smaRefs.current[period] = line;
    }

    chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, candles.length - 180), to: candles.length + 5 });
    chartRef.current = chart;
    seriesRef.current = series;
    volumeRef.current = volume;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [candles]);

  useEffect(() => {
    smaRefs.current["20"]?.applyOptions({ visible: indicators["20"] });
    smaRefs.current["50"]?.applyOptions({ visible: indicators["50"] });
    volumeRef.current?.applyOptions({ visible: indicators.volume });
  }, [indicators]);

  // ---- coordinate helpers --------------------------------------------------
  const toXY = useCallback((p: ChartPoint) => {
    const x = chartRef.current?.timeScale().timeToCoordinate(p.time);
    const y = seriesRef.current?.priceToCoordinate(p.price);
    return x == null || y == null ? null : { x: x as number, y: y as number };
  }, []);

  const toPoint = useCallback((x: number, y: number): ChartPoint | null => {
    const time = chartRef.current?.timeScale().coordinateToTime(x);
    const price = seriesRef.current?.coordinateToPrice(y);
    return time == null || price == null ? null : { time: timeToString(time), price: +price.toFixed(4) };
  }, []);

  // ---- drawing -------------------------------------------------------------
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const el = containerRef.current;
    if (!canvas || !el) return;
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = el.getBoundingClientRect();
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.lineWidth = 1.75;

    const drawSegment = (a: ChartPoint, b: ChartPoint, color: string, extend = false) => {
      const p1 = toXY(a);
      const p2 = toXY(b);
      if (!p1 || !p2) return;
      let { x: x2, y: y2 } = p2;
      if (extend && p2.x !== p1.x) {
        // Project the ray to the right edge of the chart.
        const slope = (p2.y - p1.y) / (p2.x - p1.x);
        x2 = width;
        y2 = p1.y + slope * (width - p1.x);
      }
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      for (const p of [p1, p2]) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawFib = (a: ChartPoint, b: ChartPoint) => {
      const p1 = toXY(a);
      const p2 = toXY(b);
      if (!p1 || !p2) return;
      const left = Math.min(p1.x, p2.x);
      for (const level of FIB_LEVELS) {
        const price = b.price + (a.price - b.price) * level;
        const y = seriesRef.current?.priceToCoordinate(price);
        if (y == null) continue;
        ctx.strokeStyle = level === 0.618 ? BLUE : "#94A3B8";
        ctx.setLineDash(level === 0 || level === 1 ? [] : [4, 4]);
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(width - 60, y);
        ctx.stroke();
        ctx.fillStyle = "#475569";
        ctx.fillText(`${(level * 100).toFixed(1)}%  ${price.toFixed(2)}`, left + 4, y - 4);
      }
      ctx.setLineDash([]);
    };

    for (const ann of annotations) {
      if (ann.type === "trendline") drawSegment(ann.a, ann.b, BLUE, true);
      if (ann.type === "fibonacci") drawFib(ann.a, ann.b);
      if (ann.type === "hline") {
        const y = seriesRef.current?.priceToCoordinate(ann.price);
        if (y == null) continue;
        ctx.strokeStyle = "#0F172A";
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width - 60, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#0F172A";
        ctx.fillText(ann.price.toFixed(2), 6, y - 4);
      }
      if (ann.type === "note") {
        const p = toXY(ann.at);
        if (!p) continue;
        const w = ctx.measureText(ann.text).width + 12;
        ctx.fillStyle = "#FEF3C7";
        ctx.strokeStyle = "#F59E0B";
        ctx.beginPath();
        ctx.roundRect(p.x, p.y - 22, w, 20, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#0F172A";
        ctx.fillText(ann.text, p.x + 6, p.y - 8);
      }
    }

    if (draft) {
      if (tool === "fibonacci") drawFib(draft.a, draft.b);
      else drawSegment(draft.a, draft.b, "#60A5FA");
    }
  }, [annotations, draft, tool, toXY]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const onChange = () => requestAnimationFrame(redraw);
    chart.timeScale().subscribeVisibleLogicalRangeChange(onChange);
    chart.timeScale().subscribeSizeChange(onChange);
    const ro = new ResizeObserver(onChange);
    ro.observe(containerRef.current!);
    onChange();
    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onChange);
      chart.timeScale().unsubscribeSizeChange(onChange);
      ro.disconnect();
    };
  }, [redraw]);

  // ---- pointer handling (only while a drawing tool is active) --------------
  function localXY(e: React.PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function update(next: Annotation[]) {
    setAnnotations(next);
    setDirty(true);
    setStatus("");
  }

  function onPointerDown(e: React.PointerEvent) {
    const { x, y } = localXY(e);
    const point = toPoint(x, y);

    if (tool === "eraser") {
      const hit = annotations.findLast((ann) => {
        if (ann.type === "hline") {
          const hy = seriesRef.current?.priceToCoordinate(ann.price);
          return hy != null && Math.abs(hy - y) < 6;
        }
        if (ann.type === "note") {
          const p = toXY(ann.at);
          return p != null && x >= p.x - 4 && x <= p.x + 200 && y >= p.y - 26 && y <= p.y + 4;
        }
        const p1 = toXY(ann.a);
        const p2 = toXY(ann.b);
        return p1 != null && p2 != null && distanceToSegment(x, y, p1.x, p1.y, p2.x, p2.y) < 6;
      });
      if (hit) update(annotations.filter((a) => a !== hit));
      return;
    }

    if (!point) return;
    const id = crypto.randomUUID();
    if (tool === "hline") return update([...annotations, { id, type: "hline", price: point.price }]);
    if (tool === "note") {
      const text = window.prompt("Note text")?.trim().slice(0, 80);
      if (text) update([...annotations, { id, type: "note", at: point, text }]);
      return;
    }
    if (tool === "trendline" || tool === "fibonacci") {
      canvasRef.current!.setPointerCapture(e.pointerId);
      setDraft({ a: point, b: point });
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!draft) return;
    const { x, y } = localXY(e);
    const point = toPoint(x, y);
    if (point) setDraft({ ...draft, b: point });
  }

  function onPointerUp() {
    if (!draft) return;
    if (draft.a.time !== draft.b.time || draft.a.price !== draft.b.price) {
      update([...annotations, { id: crypto.randomUUID(), type: tool as "trendline" | "fibonacci", ...draft }]);
    }
    setDraft(null);
  }

  function save() {
    startSaving(async () => {
      try {
        await saveAnnotations(ticker, annotations);
        setDirty(false);
        setStatus("Saved");
      } catch (err) {
        setStatus((err as Error).message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-card p-1">
        {TOOLS.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            size="icon"
            variant={tool === id ? "default" : "ghost"}
            onClick={() => setTool(id)}
            title={label}
            aria-label={label}
            aria-pressed={tool === id}
          >
            <Icon />
          </Button>
        ))}
        <span className="mx-1 h-6 w-px bg-border" />
        {(["20", "50", "volume"] as const).map((key) => (
          <Button
            key={key}
            size="sm"
            variant={indicators[key] ? "secondary" : "ghost"}
            onClick={() => setIndicators((s) => ({ ...s, [key]: !s[key] }))}
            aria-pressed={indicators[key]}
          >
            {key === "volume" ? "Volume" : `SMA ${key}`}
          </Button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {status && <span className="text-xs text-muted-foreground">{status}</span>}
          <Button size="icon" variant="ghost" title="Clear drawings" aria-label="Clear drawings" onClick={() => update([])}>
            <Trash2 />
          </Button>
          {signedIn && (
            <Button size="sm" onClick={save} disabled={!dirty || saving}>
              <Save /> {saving ? "Saving…" : "Save"}
            </Button>
          )}
        </div>
      </div>
      <div className="relative h-[480px] overflow-hidden rounded-lg border border-border">
        {/* z-0 gives the chart its own stacking context so the drawing layer sits above its canvases */}
        <div ref={containerRef} className="absolute inset-0 z-0" />
        <canvas
          ref={canvasRef}
          className={cn(
            "absolute inset-0 z-10 size-full",
            tool === "cursor" ? "pointer-events-none" : tool === "eraser" ? "cursor-pointer" : "cursor-crosshair",
          )}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
      </div>
    </div>
  );
}
