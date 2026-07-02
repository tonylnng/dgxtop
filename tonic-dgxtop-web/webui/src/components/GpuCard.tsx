import type { GpuMetrics } from "@/types/api";
import { Gauge } from "./Gauge";
import { bytes, celsius, pct, watts } from "./format";
import { Link } from "react-router-dom";

export function GpuCard({ g }: { g: GpuMetrics }) {
  const memPct = g.mem_total_bytes ? (g.mem_used_bytes / g.mem_total_bytes) * 100 : 0;
  const powerPct = g.power_limit_w ? (g.power_draw_w / g.power_limit_w) * 100 : 0;

  return (
    <Link
      to={`/gpu/${g.index}`}
      className="panel hover:border-accent transition-colors block"
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs text-muted">GPU {g.index}</div>
          <div className="text-sm text-slate-200 truncate max-w-[240px]">{g.name}</div>
        </div>
        <div className="flex gap-1 flex-wrap justify-end">
          {g.throttle_reasons.length > 0 && (
            <span className="pill text-warn border-warn/40">THROTTLE</span>
          )}
          {g.performance_state !== null && (
            <span className="pill">P{g.performance_state}</span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Gauge label="Util" value={g.util_gpu_pct} warn={80} bad={95} suffix="%" />
        <Gauge label="VRAM" value={memPct} warn={80} bad={95} suffix="%" />
        <Gauge label="Temp" value={g.temperature_c} max={100} warn={75} bad={87} suffix="°C" />
        <Gauge label="Power" value={powerPct} warn={80} bad={95} suffix="%" />
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-muted">
        <div>VRAM <span className="text-slate-200">{bytes(g.mem_used_bytes)}/{bytes(g.mem_total_bytes)}</span></div>
        <div>Power <span className="text-slate-200">{watts(g.power_draw_w)}</span></div>
        <div>Temp <span className="text-slate-200">{celsius(g.temperature_c)}</span></div>
        <div>SM <span className="text-slate-200">{g.sm_clock_mhz} MHz</span></div>
      </div>

      <div className="mt-2 text-[10px] text-muted">
        Util {pct(g.util_gpu_pct)} · Enc {pct(g.encoder_util_pct)} · Dec {pct(g.decoder_util_pct)}
      </div>
    </Link>
  );
}
