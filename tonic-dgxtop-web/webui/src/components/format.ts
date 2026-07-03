export function bytes(v: number): string {
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let i = 0;
  let x = v;
  while (x >= 1024 && i < units.length - 1) { x /= 1024; i++; }
  return `${x.toFixed(x >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function bps(v: number): string {
  return `${bytes(v)}/s`;
}

export function pct(v: number, digits = 0): string {
  return `${v.toFixed(digits)}%`;
}

export function watts(v: number): string {
  return `${v.toFixed(0)} W`;
}

export function celsius(v: number): string {
  return `${v.toFixed(0)} °C`;
}

export function thresholdClass(v: number, warn: number, bad: number): string {
  if (v >= bad) return "text-bad";
  if (v >= warn) return "text-warn";
  return "text-good";
}
