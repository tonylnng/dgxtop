import { NavLink } from "react-router-dom";
import clsx from "clsx";

export function Header({ connected, ts }: { connected: boolean; ts?: string }) {
  const link = ({ isActive }: { isActive: boolean }) =>
    clsx(
      "px-3 py-1.5 rounded-lg text-sm",
      isActive ? "bg-panel2 text-accent" : "text-muted hover:text-slate-200"
    );
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-line">
      <div className="flex items-center gap-6">
        <div className="text-lg font-semibold tracking-wider">
          <span className="text-accent">dgx</span>top<span className="text-muted">/web</span>
        </div>
        <nav className="flex gap-1">
          <NavLink to="/" end className={link}>Overview</NavLink>
          <NavLink to="/gpu/0" className={link}>GPU</NavLink>
          <NavLink to="/processes" className={link}>Processes</NavLink>
        </nav>
      </div>
      <div className="flex items-center gap-3 text-xs">
        {ts && <span className="text-muted">{new Date(ts).toLocaleTimeString()}</span>}
        <span
          className={clsx(
            "pill",
            connected ? "text-good border-good/40" : "text-bad border-bad/40"
          )}
        >
          {connected ? "LIVE" : "OFFLINE"}
        </span>
      </div>
    </header>
  );
}
