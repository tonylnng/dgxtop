"""CPU, memory, disk, network collectors via psutil."""
from __future__ import annotations

import logging
import time
from typing import Optional

import psutil

from ..models import (
    CpuMetrics,
    DiskDeviceMetrics,
    MemoryMetrics,
    NetworkInterfaceMetrics,
)

log = logging.getLogger(__name__)


class CpuCollector:
    def __init__(self) -> None:
        psutil.cpu_percent(interval=None, percpu=True)  # prime counters

    def collect(self) -> CpuMetrics:
        per_core = psutil.cpu_percent(interval=None, percpu=True)
        agg = sum(per_core) / len(per_core) if per_core else 0.0
        try:
            load1, load5, load15 = psutil.getloadavg()
        except (AttributeError, OSError):
            load1 = load5 = load15 = 0.0
        try:
            temps = psutil.sensors_temperatures(fahrenheit=False)
            cpu_temp = _pick_cpu_temp(temps)
        except (AttributeError, OSError):
            cpu_temp = None
        try:
            freq = psutil.cpu_freq()
            freq_mhz = freq.current if freq else None
        except Exception:  # noqa: BLE001
            freq_mhz = None

        procs_running = len(
            [p for p in psutil.process_iter(["status"]) if p.info["status"] == psutil.STATUS_RUNNING]
        )
        procs_total = len(psutil.pids())

        return CpuMetrics(
            util_pct=float(agg),
            per_core_pct=[float(x) for x in per_core],
            load_avg_1=float(load1),
            load_avg_5=float(load5),
            load_avg_15=float(load15),
            tasks_running=procs_running,
            tasks_total=procs_total,
            temperature_c=cpu_temp,
            freq_mhz=freq_mhz,
        )


def _pick_cpu_temp(sensors: dict) -> Optional[float]:
    for key in ("coretemp", "k10temp", "cpu_thermal", "cpu-thermal"):
        entries = sensors.get(key)
        if entries:
            vals = [e.current for e in entries if e.current is not None]
            if vals:
                return float(sum(vals) / len(vals))
    return None


class MemoryCollector:
    def collect(self) -> MemoryMetrics:
        vm = psutil.virtual_memory()
        sw = psutil.swap_memory()
        return MemoryMetrics(
            ram_used_bytes=int(vm.used),
            ram_total_bytes=int(vm.total),
            ram_available_bytes=int(vm.available),
            ram_cached_bytes=int(getattr(vm, "cached", 0)),
            ram_buffers_bytes=int(getattr(vm, "buffers", 0)),
            swap_used_bytes=int(sw.used),
            swap_total_bytes=int(sw.total),
        )


class DiskCollector:
    """Tracks per-device I/O deltas between successive `collect()` calls."""

    def __init__(self) -> None:
        self._prev: dict[str, tuple[float, psutil._common.sdiskio]] = {}

    def collect(self) -> list[DiskDeviceMetrics]:
        now = time.monotonic()
        io_counters = psutil.disk_io_counters(perdisk=True) or {}
        partitions = {
            p.device: p for p in psutil.disk_partitions(all=False)
            if not p.mountpoint.startswith(("/snap", "/var/lib/docker"))
        }

        out: list[DiskDeviceMetrics] = []
        for device, part in partitions.items():
            try:
                usage = psutil.disk_usage(part.mountpoint)
            except (PermissionError, FileNotFoundError, OSError):
                continue
            short = device.split("/")[-1]
            base = _base_device(short)
            io = io_counters.get(short) or io_counters.get(base)
            read_bps = write_bps = 0.0
            read_iops = write_iops = 0.0
            if io and base in self._prev:
                prev_t, prev_io = self._prev[base]
                dt = max(now - prev_t, 1e-6)
                read_bps = (io.read_bytes - prev_io.read_bytes) / dt
                write_bps = (io.write_bytes - prev_io.write_bytes) / dt
                read_iops = (io.read_count - prev_io.read_count) / dt
                write_iops = (io.write_count - prev_io.write_count) / dt
            if io:
                self._prev[base] = (now, io)

            out.append(
                DiskDeviceMetrics(
                    device=device,
                    mountpoint=part.mountpoint,
                    fs_used_bytes=int(usage.used),
                    fs_total_bytes=int(usage.total),
                    fs_free_bytes=int(usage.free),
                    read_bps=max(read_bps, 0.0),
                    write_bps=max(write_bps, 0.0),
                    read_iops=max(read_iops, 0.0),
                    write_iops=max(write_iops, 0.0),
                )
            )
        return out


def _base_device(name: str) -> str:
    """nvme0n1p1 -> nvme0n1, sda1 -> sda."""
    import re

    if name.startswith("nvme"):
        return re.sub(r"p\d+$", "", name)
    return re.sub(r"\d+$", "", name)


class NetworkCollector:
    def __init__(self) -> None:
        self._prev_ts: Optional[float] = None
        self._prev: dict = {}

    def collect(self) -> list[NetworkInterfaceMetrics]:
        now = time.monotonic()
        counters = psutil.net_io_counters(pernic=True)
        out: list[NetworkInterfaceMetrics] = []
        for name, c in counters.items():
            if name == "lo" or name.startswith(("docker", "br-", "veth")):
                continue
            rx_bps = tx_bps = 0.0
            if self._prev_ts is not None and name in self._prev:
                dt = max(now - self._prev_ts, 1e-6)
                p = self._prev[name]
                rx_bps = (c.bytes_recv - p.bytes_recv) / dt
                tx_bps = (c.bytes_sent - p.bytes_sent) / dt
            out.append(
                NetworkInterfaceMetrics(
                    name=name,
                    rx_bps=max(rx_bps, 0.0),
                    tx_bps=max(tx_bps, 0.0),
                    rx_errors=int(c.errin),
                    tx_errors=int(c.errout),
                    rx_total_bytes=int(c.bytes_recv),
                    tx_total_bytes=int(c.bytes_sent),
                )
            )
            self._prev[name] = c
        self._prev_ts = now
        return out
