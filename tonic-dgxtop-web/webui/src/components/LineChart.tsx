import ReactECharts from "echarts-for-react";
import type { HistorySeries } from "@/types/api";

/**
 * Thin ECharts wrapper for a single-series line chart. Consumers pass in a
 * HistorySeries from `/api/history` plus an optional formatter for the y-axis.
 */
export function LineChart({
  series,
  color = "#22d3ee",
  yFormatter,
  height = 160,
}: {
  series: HistorySeries | null;
  color?: string;
  yFormatter?: (v: number) => string;
  height?: number;
}) {
  const data = (series?.points ?? []).map((p) => [p.ts, p.value]);

  const option = {
    grid: { left: 44, right: 8, top: 8, bottom: 20 },
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "time",
      axisLine: { lineStyle: { color: "#28324f" } },
      axisLabel: { color: "#94a3b8", fontSize: 10 },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      axisLine: { lineStyle: { color: "#28324f" } },
      axisLabel: {
        color: "#94a3b8",
        fontSize: 10,
        formatter: yFormatter ?? ((v: number) => `${v}`),
      },
      splitLine: { lineStyle: { color: "#1a2340" } },
    },
    series: [
      {
        type: "line",
        showSymbol: false,
        smooth: true,
        data,
        lineStyle: { color, width: 2 },
        areaStyle: {
          color: {
            type: "linear",
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: `${color}55` },
              { offset: 1, color: `${color}00` },
            ],
          },
        },
      },
    ],
  };

  return (
    <ReactECharts
      option={option}
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
    />
  );
}
