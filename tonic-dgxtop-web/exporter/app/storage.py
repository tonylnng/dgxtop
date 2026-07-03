"""TimescaleDB writer & reader.

Design:
- Single wide `metrics` hypertable keyed on (time, metric, gpu_index, device).
- Writer batches all data points from one snapshot into a single COPY-style insert.
- Reader supports point-in-time snapshot (latest) and range queries with server-side
  time_bucket aggregation to cap payload size.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Iterable, Optional

import asyncpg

from .models import HistoryPoint, HistorySeries, Snapshot

log = logging.getLogger(__name__)


class MetricsStore:
    def __init__(self, dsn: str) -> None:
        self._dsn = dsn
        self._pool: Optional[asyncpg.Pool] = None

    async def connect(self) -> None:
        self._pool = await asyncpg.create_pool(
            self._dsn, min_size=1, max_size=4, command_timeout=10
        )
        log.info("connected to TimescaleDB")

    async def close(self) -> None:
        if self._pool:
            await self._pool.close()

    async def write_snapshot(self, snap: Snapshot) -> None:
        if not self._pool:
            return
        rows = list(_flatten(snap))
        if not rows:
            return
        async with self._pool.acquire() as conn:
            await conn.executemany(
                """
                INSERT INTO metrics (ts, metric, gpu_index, device, value)
                VALUES ($1, $2, $3, $4, $5)
                """,
                rows,
            )

    async def history(
        self,
        metric: str,
        since: datetime,
        gpu_index: Optional[int] = None,
        device: Optional[str] = None,
        bucket_seconds: int = 10,
    ) -> HistorySeries:
        assert self._pool is not None
        params: list = [metric, since, timedelta(seconds=bucket_seconds)]
        filters = ["metric = $1", "ts >= $2"]
        if gpu_index is not None:
            filters.append(f"gpu_index = ${len(params) + 1}")
            params.append(gpu_index)
        if device is not None:
            filters.append(f"device = ${len(params) + 1}")
            params.append(device)
        where = " AND ".join(filters)
        sql = f"""
            SELECT time_bucket($3, ts) AS bucket, AVG(value) AS v
            FROM metrics
            WHERE {where}
            GROUP BY bucket
            ORDER BY bucket
        """
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(sql, *params)
        return HistorySeries(
            metric=metric,
            gpu_index=gpu_index,
            points=[HistoryPoint(ts=r["bucket"], value=float(r["v"] or 0.0)) for r in rows],
        )


def _flatten(snap: Snapshot) -> Iterable[tuple]:
    ts = snap.timestamp
    for g in snap.gpus:
        yield (ts, "gpu.util", g.index, None, g.util_gpu_pct)
        yield (ts, "gpu.mem_pct", g.index, None,
               (g.mem_used_bytes / g.mem_total_bytes * 100.0) if g.mem_total_bytes else 0.0)
        yield (ts, "gpu.mem_used_bytes", g.index, None, float(g.mem_used_bytes))
        yield (ts, "gpu.temp_c", g.index, None, g.temperature_c)
        yield (ts, "gpu.power_w", g.index, None, g.power_draw_w)
        yield (ts, "gpu.pcie_tx_kbps", g.index, None, float(g.pcie_tx_kbps))
        yield (ts, "gpu.pcie_rx_kbps", g.index, None, float(g.pcie_rx_kbps))
        yield (ts, "gpu.sm_clock_mhz", g.index, None, float(g.sm_clock_mhz))

    yield (ts, "cpu.util", None, None, snap.cpu.util_pct)
    if snap.cpu.temperature_c is not None:
        yield (ts, "cpu.temp_c", None, None, snap.cpu.temperature_c)
    yield (ts, "cpu.load1", None, None, snap.cpu.load_avg_1)

    yield (ts, "mem.used_pct", None, None,
           (snap.memory.ram_used_bytes / snap.memory.ram_total_bytes * 100.0)
           if snap.memory.ram_total_bytes else 0.0)
    yield (ts, "mem.used_bytes", None, None, float(snap.memory.ram_used_bytes))

    for d in snap.disks:
        yield (ts, "disk.read_bps", None, d.device, d.read_bps)
        yield (ts, "disk.write_bps", None, d.device, d.write_bps)
        yield (ts, "disk.used_pct", None, d.device,
               (d.fs_used_bytes / d.fs_total_bytes * 100.0) if d.fs_total_bytes else 0.0)

    for n in snap.network:
        yield (ts, "net.rx_bps", None, n.name, n.rx_bps)
        yield (ts, "net.tx_bps", None, n.name, n.tx_bps)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)
