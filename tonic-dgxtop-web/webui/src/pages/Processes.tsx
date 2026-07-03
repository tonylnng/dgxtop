import { useMemo, useState } from "react";
import type { Snapshot } from "@/types/api";
import { bytes, pct } from "@/components/format";

type SortKey = "gpu_mem" | "gpu_util" | "cpu" | "pid" | "user";

export function Processes({ snap }: { snap: Snapshot }) {
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<SortKey>("gpu_mem");

  const rows = useMemo(() => {
    let r = snap.processes.slice();
    const f = filter.trim().toLowerCase();
    if (f) {
      r = r.filter(
        (p) =>
          String(p.pid).includes(f) ||
          p.user.toLowerCase().includes(f) ||
          p.command.toLowerCase().includes(f)
      );
    }
    r.sort((a, b) => {
      switch (sort) {
        case "gpu_util": return (b.gpu_util_pct ?? 0) - (a.gpu_util_pct ?? 0);
        case "cpu": return b.cpu_pct - a.cpu_pct;
        case "pid": return a.pid - b.pid;
        case "user": return a.user.localeCompare(b.user);
        case "gpu_mem":
        default:
          return b.gpu_mem_bytes - a.gpu_mem_bytes;
      }
    });
    return r;
  }, [snap.processes, filter, sort]);

  return (
    <div className="p-6">
      <div className="panel">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <div className="panel-title !mb-0">GPU Processes ({rows.length})</div>
          <div className="flex items-center gap-2">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="filter pid / user / command"
              className="bg-panel2 border border-line rounded-lg text-xs px-2 py-1 w-64 focus:outline-none focus:border-accent"
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="bg-panel2 border border-line rounded-lg text-xs px-2 py-1 focus:outline-none focus:border-accent"
            >
              <option value="gpu_mem">Sort: GPU mem</option>
              <option value="gpu_util">Sort: GPU util</option>
              <option value="cpu">Sort: CPU %</option>
              <option value="pid">Sort: PID</option>
              <option value="user">Sort: User</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted">
              <tr className="text-left">
                <th className="py-1">PID</th>
                <th>User</th>
                <th>GPU</th>
                <th>Type</th>
                <th className="text-right">GPU util</th>
                <th className="text-right">VRAM</th>
                <th className="text-right">CPU</th>
                <th className="text-right">Host mem</th>
                <th>Command</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={`${p.pid}-${p.gpu_index}`} className="border-t border-line/60 hover:bg-panel2/40">
                  <td className="py-1 text-slate-200">{p.pid}</td>
                  <td>{p.user}</td>
                  <td>#{p.gpu_index}</td>
                  <td><span className="pill">{p.proc_type}</span></td>
                  <td className="text-right">{p.gpu_util_pct !== null ? pct(p.gpu_util_pct) : "-"}</td>
                  <td className="text-right">{bytes(p.gpu_mem_bytes)}</td>
                  <td className="text-right">{pct(p.cpu_pct, 1)}</td>
                  <td className="text-right">{bytes(p.host_mem_bytes)}</td>
                  <td className="truncate max-w-[520px]" title={p.command}>{p.command}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={9} className="text-center text-muted py-6">No GPU processes.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
