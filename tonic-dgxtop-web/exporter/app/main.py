"""FastAPI application entrypoint.

Responsibilities:
- Boot collectors + TimescaleDB pool at startup.
- Run a background task that polls the host at `POLL_INTERVAL_SEC` and:
    * caches the latest snapshot in memory
    * writes each snapshot to TimescaleDB
    * fan-outs to all active WebSocket clients
- Expose REST endpoints for snapshot, history, and Prometheus scraping.
"""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import PlainTextResponse

from .collectors import (
    CpuCollector,
    DiskCollector,
    GpuCollector,
    GpuProcessCollector,
    MemoryCollector,
    NetworkCollector,
)
from .config import settings
from .models import Snapshot
from .storage import MetricsStore

logging.basicConfig(level=settings.log_level.upper(), format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("exporter")


class AppState:
    """Shared runtime state — collectors, latest snapshot, WS clients, DB."""

    def __init__(self) -> None:
        self.gpu = GpuCollector() if settings.enable_gpu else _NullGpu()
        self.cpu = CpuCollector()
        self.mem = MemoryCollector()
        self.disk = DiskCollector()
        self.net = NetworkCollector()
        self.procs = GpuProcessCollector(self.gpu)
        self.latest: Optional[Snapshot] = None
        self.ws_clients: set[WebSocket] = set()
        self.store = MetricsStore(settings.postgres_dsn)


class _NullGpu:
    available = False
    _handles: list = []
    _nvml = None

    def collect(self) -> list:
        return []

    def shutdown(self) -> None:  # noqa: D401
        return None


state = AppState()


async def _poll_loop() -> None:
    interval = max(settings.poll_interval_sec, 0.1)
    while True:
        try:
            snap = Snapshot(
                timestamp=datetime.now(timezone.utc),
                gpus=state.gpu.collect(),
                cpu=state.cpu.collect(),
                memory=state.mem.collect(),
                disks=state.disk.collect(),
                network=state.net.collect(),
                processes=state.procs.collect(),
            )
            state.latest = snap
            try:
                await state.store.write_snapshot(snap)
            except Exception as exc:  # noqa: BLE001
                log.warning("db write failed: %s", exc)
            await _fanout(snap)
        except Exception as exc:  # noqa: BLE001
            log.exception("poll loop error: %s", exc)
        await asyncio.sleep(interval)


async def _fanout(snap: Snapshot) -> None:
    if not state.ws_clients:
        return
    payload = snap.model_dump_json()
    dead: list[WebSocket] = []
    for ws in list(state.ws_clients):
        try:
            await ws.send_text(payload)
        except Exception:  # noqa: BLE001
            dead.append(ws)
    for ws in dead:
        state.ws_clients.discard(ws)


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001
    # DB connect with retry — db container may still be starting.
    for attempt in range(30):
        try:
            await state.store.connect()
            break
        except Exception as exc:  # noqa: BLE001
            log.warning("db connect attempt %d failed: %s", attempt + 1, exc)
            await asyncio.sleep(2.0)
    task = asyncio.create_task(_poll_loop(), name="poll-loop")
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
        await state.store.close()
        state.gpu.shutdown()


app = FastAPI(title="dgxtop-web exporter", version="0.1.0", lifespan=lifespan)


@app.get("/healthz", response_class=PlainTextResponse)
async def healthz() -> str:
    return "ok"


@app.get("/api/snapshot", response_model=Snapshot)
async def api_snapshot() -> Snapshot:
    if state.latest is None:
        raise HTTPException(status_code=503, detail="no snapshot yet")
    return state.latest


@app.get("/api/history")
async def api_history(
    metric: str = Query(..., description="Metric name, e.g. gpu.util"),
    range: str = Query("1h", description="1h | 6h | 12h | 24h"),
    gpu_index: Optional[int] = Query(None),
    device: Optional[str] = Query(None),
):
    hours = {"1h": 1, "6h": 6, "12h": 12, "24h": 24}.get(range)
    if hours is None:
        raise HTTPException(status_code=400, detail="range must be 1h|6h|12h|24h")
    # Bucket size scales with window so payload stays ~360 points.
    bucket = max(10, hours * 3600 // 360)
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    series = await state.store.history(
        metric=metric,
        since=since,
        gpu_index=gpu_index,
        device=device,
        bucket_seconds=bucket,
    )
    return series


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket) -> None:
    await ws.accept()
    state.ws_clients.add(ws)
    try:
        if state.latest is not None:
            await ws.send_text(state.latest.model_dump_json())
        while True:
            # Keep the socket open; client doesn't need to send anything.
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        state.ws_clients.discard(ws)


@app.get("/metrics", response_class=PlainTextResponse)
async def prometheus_metrics() -> str:
    """Minimal Prometheus text-format exposition of the latest snapshot."""
    snap = state.latest
    if snap is None:
        return "# no data yet\n"
    lines: list[str] = []
    for g in snap.gpus:
        labels = f'{{gpu="{g.index}",name="{_esc(g.name)}"}}'
        lines.append(f"dgx_gpu_util_percent{labels} {g.util_gpu_pct}")
        lines.append(f"dgx_gpu_mem_used_bytes{labels} {g.mem_used_bytes}")
        lines.append(f"dgx_gpu_mem_total_bytes{labels} {g.mem_total_bytes}")
        lines.append(f"dgx_gpu_temperature_c{labels} {g.temperature_c}")
        lines.append(f"dgx_gpu_power_watts{labels} {g.power_draw_w}")
    lines.append(f"dgx_cpu_util_percent {snap.cpu.util_pct}")
    lines.append(f"dgx_memory_used_bytes {snap.memory.ram_used_bytes}")
    lines.append(f"dgx_memory_total_bytes {snap.memory.ram_total_bytes}")
    return "\n".join(lines) + "\n"


def _esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')
