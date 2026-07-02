import type { HistorySeries, Snapshot } from "@/types/api";

const base = ""; // proxied by nginx / vite

export async function fetchSnapshot(): Promise<Snapshot> {
  const r = await fetch(`${base}/api/snapshot`);
  if (!r.ok) throw new Error(`snapshot ${r.status}`);
  return r.json();
}

export async function fetchHistory(params: {
  metric: string;
  range: "1h" | "6h" | "12h" | "24h";
  gpu_index?: number;
  device?: string;
}): Promise<HistorySeries> {
  const q = new URLSearchParams({ metric: params.metric, range: params.range });
  if (params.gpu_index !== undefined) q.set("gpu_index", String(params.gpu_index));
  if (params.device) q.set("device", params.device);
  const r = await fetch(`${base}/api/history?${q}`);
  if (!r.ok) throw new Error(`history ${r.status}`);
  return r.json();
}
