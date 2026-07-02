"""GPU process collector — joins NVML compute-proc list with psutil host stats."""
from __future__ import annotations

import logging
from typing import Optional

import psutil

from ..models import GpuProcess

log = logging.getLogger(__name__)


class GpuProcessCollector:
    def __init__(self, gpu_collector) -> None:  # noqa: ANN001
        self._gpu = gpu_collector

    def collect(self) -> list[GpuProcess]:
        if not self._gpu.available:
            return []
        p = self._gpu._nvml  # noqa: SLF001
        results: list[GpuProcess] = []
        for idx, h in enumerate(self._gpu._handles):  # noqa: SLF001
            try:
                compute = _safe_list(lambda: p.nvmlDeviceGetComputeRunningProcesses(h))
                graphics = _safe_list(lambda: p.nvmlDeviceGetGraphicsRunningProcesses(h))
            except Exception as exc:  # noqa: BLE001
                log.debug("proc list failed on gpu %d: %s", idx, exc)
                continue

            by_pid: dict[int, tuple[str, int]] = {}
            for proc in compute:
                by_pid[int(proc.pid)] = ("C", int(getattr(proc, "usedGpuMemory", 0) or 0))
            for proc in graphics:
                pid = int(proc.pid)
                mem = int(getattr(proc, "usedGpuMemory", 0) or 0)
                if pid in by_pid:
                    prev_type, prev_mem = by_pid[pid]
                    by_pid[pid] = ("C+G", max(prev_mem, mem))
                else:
                    by_pid[pid] = ("G", mem)

            for pid, (ptype, gpu_mem) in by_pid.items():
                user, cpu_pct, host_mem, cmd = _psutil_lookup(pid)
                results.append(
                    GpuProcess(
                        pid=pid,
                        gpu_index=idx,
                        user=user,
                        proc_type=ptype,
                        gpu_mem_bytes=gpu_mem,
                        cpu_pct=cpu_pct,
                        host_mem_bytes=host_mem,
                        command=cmd,
                    )
                )
        return results


def _safe_list(fn):  # noqa: ANN001, ANN201
    try:
        return fn() or []
    except Exception:  # noqa: BLE001
        return []


def _psutil_lookup(pid: int) -> tuple[str, float, int, str]:
    try:
        proc = psutil.Process(pid)
        with proc.oneshot():
            user = proc.username()
            cpu = proc.cpu_percent(interval=None)
            mem = proc.memory_info().rss
            cmdline = proc.cmdline()
            cmd = " ".join(cmdline) if cmdline else proc.name()
        return user, float(cpu), int(mem), cmd[:512]
    except (psutil.NoSuchProcess, psutil.AccessDenied, ProcessLookupError):
        return "unknown", 0.0, 0, ""
