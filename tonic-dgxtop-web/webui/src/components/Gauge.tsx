import clsx from "clsx";

/** Simple horizontal gauge bar with color thresholds. */
export function Gauge({
  value,
  max = 100,
  warn = 70,
  bad = 90,
  label,
  suffix,
}: {
  value: number;
  max?: number;
  warn?: number;
  bad?: number;
  label?: string;
  suffix?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const cls =
    pct >= bad ? "bg-bad" : pct >= warn ? "bg-warn" : "bg-good";
  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-xs text-muted mb-1">
          <span>{label}</span>
          <span className="text-slate-200">
            {value.toFixed(0)}
            {suffix ?? ""}
          </span>
        </div>
      )}
      <div className="h-2 rounded-full bg-panel2 overflow-hidden">
        <div className={clsx("h-full transition-all", cls)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
