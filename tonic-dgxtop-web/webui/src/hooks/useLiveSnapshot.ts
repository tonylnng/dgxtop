import { useEffect, useRef, useState } from "react";
import type { Snapshot } from "@/types/api";

/**
 * Subscribes to the exporter WebSocket and yields the latest Snapshot.
 * Auto-reconnects with exponential backoff (max 15s).
 */
export function useLiveSnapshot(): { snapshot: Snapshot | null; connected: boolean } {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const backoffRef = useRef(1000);

  useEffect(() => {
    let stopped = false;

    function connect() {
      if (stopped) return;
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${proto}://${location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        backoffRef.current = 1000;
      };
      ws.onmessage = (ev) => {
        try {
          setSnapshot(JSON.parse(ev.data));
        } catch {
          /* ignore malformed frame */
        }
      };
      ws.onclose = () => {
        setConnected(false);
        if (stopped) return;
        const delay = Math.min(backoffRef.current, 15000);
        backoffRef.current = Math.min(backoffRef.current * 2, 15000);
        setTimeout(connect, delay);
      };
      ws.onerror = () => ws.close();
    }
    connect();

    return () => {
      stopped = true;
      wsRef.current?.close();
    };
  }, []);

  return { snapshot, connected };
}
