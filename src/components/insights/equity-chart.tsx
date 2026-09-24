"use client";

import { useEffect, useRef } from "react";
import { AreaSeries, ColorType, createChart } from "lightweight-charts";

export function EquityChart({ data }: { data: { time: string; value: number }[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const chart = createChart(ref.current!, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#64748B", fontSize: 11 },
      grid: { vertLines: { visible: false }, horzLines: { color: "#F1F5F9" } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      handleScroll: false,
      handleScale: false,
    });
    const series = chart.addSeries(AreaSeries, {
      lineColor: "#2563EB",
      topColor: "#2563EB33",
      bottomColor: "#2563EB00",
      lineWidth: 2,
      priceLineVisible: false,
    });
    series.setData(data);
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [data]);

  return <div ref={ref} className="h-56 w-full" />;
}
