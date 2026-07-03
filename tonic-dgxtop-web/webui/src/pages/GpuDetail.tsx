import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { HistorySeries, Snapshot } from "@/types/api";
import { Gauge } from "@/components/Gauge";
import { LineChart } from "@/components/LineChart";
import { bytes, celsius, pct, watts } from "@/components/format";
import { fetchHistory } from "@/api/client";

type Range = "1h" | "6h" | "12h" | "24h";

export function GpuDetail({ snap }: { snap: Snapshot }) {
  const { id } = useParams();
  const idx = Number(id ?? 0);
  const g = snap.gpus.find((x) => x.index === idx);
  const [range, setRange] = useState<Range>("1h");
  const [utilH, setUtilH] = useState<HistorySeries | null>(null);
  const [memH, setMemH] = useState<HistorySeries | null>(null);
  const [tempH, setTempH] = useState<HistorySeries | null>(null);
  const [powH, setPowH] = useState<HistorySeries | null>(null);

  useEffect(() => {
    const load = () => {
      fetchHistory({ metric: "gpu.util", range, gpu_index: idx }).then(setUtilH).catch(() => {});
      fetchHistory({ metric: "gpu.mem_pct", range, gpu_index: idx }).then(setMemH).catch(() => {});
      fetchHistory({ metric: "gpu.temp_c", range, gpu_index: idx }).then(setTempH).catch(() => {});
      fetchHistory({ metric: "gpu.power_w", range, gpu_index: idx }).then(setPowH).catch(() => {});
    };
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [idx, range]);

  if (!g) {
    return <div className="p-6 text-muted">GPU {idx} not present.</div>;
  }

  const memPct = g.mem_total_bytes ? (g.mem_used_bytes / g.mem_total_bytes) * 100 : 0;
  const gpuList = snap.gpus.map((x) => x.index);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-muted">GPU {g.index}</div>
          <div className="text-xl text-slate-100">{g.name}</div>
          <div className="text-[11px] text-muted">{g.uuid}</div>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex gap-1">
            {gpuList.map((i) => (
              <a
                key={i}
                href={`/gpu/${i}`}
                className={`pill ${i === idx ? "text-accent border-accent/40" : ""}`}
              >
                #{i}
              </a>
            ))}
          </div>
          <div className="flex gap-1 ml-3">
            {(["1h", "6h", "12h", "24h"] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`pill ${r === range ? "text-accent border-accent/40" : ""}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Key gauges */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="panel">
          <div className="panel-title">Utilization</div>
          <div className="stat-value">{pct(g.util_gpu_pct)}</div>
          <Gauge value={g.util_gpu_pct} warn={80} bad={95} />
        </div>
        <div className="panel">
          <div className="panel-title">VRAM</div>
          <div className="stat-value">{bytes(g.mem_used_bytes)}</div>
          <div className="text-xs text-muted">/ {bytes(g.mem_total_bytes)} · {pct(memPct)}</div>
          <Gauge value={memPct} warn={80} bad={95} />
        </div>
        <div className="panel">
          <div className="panel-title">Temperature</div>
          <div className="stat-value">{celsius(g.temperature_c)}</div>
          <Gauge value={g.temperature_c} max={100} warn={75} bad={87} />
        </div>
        <div className="panel">
          <div className="panel-title">Power</div>
          <div className="stat-value">{watts(g.power_draw_w)}</div>
          <div className="text-xs text-muted">/ {watts(g.power_limit_w)}</div>
          <Gauge value={g.power_draw_w} max={g.power_limit_w || 1} warn={80} bad={95} />
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="panel">
          <div className="panel-title">GPU Utilization ({range})</div>
          <LineChart series={utilH} color="#22d3ee" yFormatter={(v) => `${v.toFixed(0)}%`} height={220} />
        </div>
        <div className="panel">
          <div className="panel-title">VRAM Used ({range})</div>
          <LineChart series={memH} color="#34d399" yFormatter={(v) => `${v.toFixed(0)}%`} height={220} />
        </div>
        <div className="panel">
          <div className="panel-title">Temperature ({range})</div>
          <LineChart series={tempH} color="#fbbf24" yFormatter={(v) => `${v.toFixed(0)}°`} height={220} />
        </div>
        <div className="panel">
          <div className="panel-title">Power ({range})</div>
          <LineChart series={powH} color="#f87171" yFormatter={(v) => `${v.toFixed(0)}W`} height={220} />
        </div>
      </div>

      {/* Detail table */}
      <div className="panel">
        <div className="panel-title">Detail</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-1 text-xs">
          <Kv k="Graphics clock" v={`${g.graphics_clock_mhz} MHz`} />
          <Kv k="SM clock" v={`${g.sm_clock_mhz} MHz`} />
          <Kv k="Memory clock" v={`${g.memory_clock_mhz} MHz`} />
          <Kv k="Performance state" v={g.performance_state !== null ? `P${g.performance_state}` : "-"} />
          <Kv k="PCIe TX" v={`${(g.pcie_tx_kbps / 1024).toFixed(1)} MB/s`} />
          <Kv k="PCIe RX" v={`${(g.pcie_rx_kbps / 1024).toFixed(1)} MB/s`} />
          <Kv k="Encoder" v={pct(g.encoder_util_pct)} />
          <Kv k="Decoder" v={pct(g.decoder_util_pct)} />
          <Kv k="ECC (corrected)" v={String(g.ecc_errors_corrected)} />
          <Kv k="ECC (uncorrected)" v={String(g.ecc_errors_uncorrected)} />
          <Kv k="Fan" v={g.fan_speed_pct !== null ? pct(g.fan_speed_pct) : "-"} />
          <Kv k="Throttle" v={g.throttle_reasons.length ? g.throttle_reasons.join(", ") : "none"} />
        </div>
      </div>
    </div>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <>
      <div className="text-muted">{k}</div>
      <div className="text-slate-200">{v}</div>
    </>
  );
}
