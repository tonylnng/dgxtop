import { useEffect, useState } from "react";
import type { HistorySeries, Snapshot } from "@/types/api";
import { GpuCard } from "@/components/GpuCard";
import { Gauge } from "@/components/Gauge";
import { LineChart } from "@/components/LineChart";
import { bps, bytes, celsius, pct } from "@/components/format";
import { fetchHistory } from "@/api/client";

export function Overview({ snap }: { snap: Snapshot }) {
  const [cpuHist, setCpuHist] = useState<HistorySeries | null>(null);
  const [memHist, setMemHist] = useState<HistorySeries | null>(null);

  useEffect(() => {
    const load = () => {
      fetchHistory({ metric: "cpu.util", range: "1h" }).then(setCpuHist).catch(() => {});
      fetchHistory({ metric: "mem.used_pct", range: "1h" }).then(setMemHist).catch(() => {});
    };
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  const memPct = snap.memory.ram_total_bytes
    ? (snap.memory.ram_used_bytes / snap.memory.ram_total_bytes) * 100
    : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Top row: CPU + Memory */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="panel">
          <div className="panel-title">CPU</div>
          <div className="flex items-baseline justify-between">
            <div className="stat-value">{pct(snap.cpu.util_pct, 1)}</div>
            <div className="text-xs text-muted">
              Load {snap.cpu.load_avg_1.toFixed(2)} / {snap.cpu.load_avg_5.toFixed(2)} / {snap.cpu.load_avg_15.toFixed(2)}
              {snap.cpu.temperature_c !== null && ` · ${celsius(snap.cpu.temperature_c)}`}
              {" · "}
              {snap.cpu.tasks_running}/{snap.cpu.tasks_total} tasks
            </div>
          </div>
          <div className="mt-3 grid grid-cols-8 gap-1">
            {snap.cpu.per_core_pct.map((v, i) => (
              <div key={i} title={`core ${i}: ${v.toFixed(0)}%`}>
                <Gauge value={v} warn={70} bad={90} />
              </div>
            ))}
          </div>
          <div className="mt-3">
            <LineChart series={cpuHist} color="#22d3ee" yFormatter={(v) => `${v.toFixed(0)}%`} />
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Memory</div>
          <div className="flex items-baseline justify-between">
            <div className="stat-value">
              {bytes(snap.memory.ram_used_bytes)}
              <span className="text-muted text-base"> / {bytes(snap.memory.ram_total_bytes)}</span>
            </div>
            <div className="text-xs text-muted">
              Swap {bytes(snap.memory.swap_used_bytes)}/{bytes(snap.memory.swap_total_bytes)}
            </div>
          </div>
          <div className="mt-3">
            <Gauge value={memPct} warn={80} bad={95} suffix="%" />
          </div>
          <div className="mt-3">
            <LineChart series={memHist} color="#34d399" yFormatter={(v) => `${v.toFixed(0)}%`} />
          </div>
        </div>
      </div>

      {/* GPU grid */}
      {snap.gpus.length > 0 && (
        <div>
          <div className="panel-title mb-2">GPUs</div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {snap.gpus.map((g) => <GpuCard key={g.index} g={g} />)}
          </div>
        </div>
      )}

      {/* Disks + Network */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="panel">
          <div className="panel-title">Disks</div>
          <table className="w-full text-xs">
            <thead className="text-muted">
              <tr className="text-left">
                <th className="py-1">Device</th>
                <th>Mount</th>
                <th className="text-right">Used</th>
                <th className="text-right">Free</th>
                <th className="text-right">Use%</th>
                <th className="text-right">R</th>
                <th className="text-right">W</th>
              </tr>
            </thead>
            <tbody>
              {snap.disks.map((d) => {
                const u = d.fs_total_bytes ? (d.fs_used_bytes / d.fs_total_bytes) * 100 : 0;
                return (
                  <tr key={d.device} className="border-t border-line/60">
                    <td className="py-1 text-slate-200">{d.device}</td>
                    <td className="text-muted">{d.mountpoint}</td>
                    <td className="text-right">{bytes(d.fs_used_bytes)}</td>
                    <td className="text-right">{bytes(d.fs_free_bytes)}</td>
                    <td className="text-right">{pct(u, 0)}</td>
                    <td className="text-right">{bps(d.read_bps)}</td>
                    <td className="text-right">{bps(d.write_bps)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <div className="panel-title">Network</div>
          <table className="w-full text-xs">
            <thead className="text-muted">
              <tr className="text-left">
                <th className="py-1">Interface</th>
                <th className="text-right">RX</th>
                <th className="text-right">TX</th>
                <th className="text-right">Errors</th>
              </tr>
            </thead>
            <tbody>
              {snap.network.map((n) => (
                <tr key={n.name} className="border-t border-line/60">
                  <td className="py-1 text-slate-200">{n.name}</td>
                  <td className="text-right">{bps(n.rx_bps)}</td>
                  <td className="text-right">{bps(n.tx_bps)}</td>
                  <td className="text-right">{n.rx_errors + n.tx_errors}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
