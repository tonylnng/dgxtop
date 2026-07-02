"""NVIDIA GPU collector via NVML (pynvml).

Reads the same metrics dgxtop's Rust GpuCollector exposes: utilization, memory,
temperature, power, clocks, PCIe throughput, ECC counters, throttle reasons.
Uses lazy initialization so the exporter still runs on hosts without NVML
present (e.g. dev machines) — such hosts simply return an empty GPU list.
"""
from __future__ import annotations

import logging
from typing import Optional

from ..models import GpuMetrics

log = logging.getLogger(__name__)


THROTTLE_BITS: dict[int, str] = {
    0x0000000000000001: "GPU_IDLE",
    0x0000000000000002: "APPLICATIONS_CLOCKS_SETTING",
    0x0000000000000004: "SW_POWER_CAP",
    0x0000000000000008: "HW_SLOWDOWN",
    0x0000000000000010: "SYNC_BOOST",
    0x0000000000000020: "SW_THERMAL_SLOWDOWN",
    0x0000000000000040: "HW_THERMAL_SLOWDOWN",
    0x0000000000000080: "HW_POWER_BRAKE_SLOWDOWN",
    0x0000000000000100: "DISPLAY_CLOCK_SETTING",
}


class GpuCollector:
    """Wraps pynvml handles; safe to call `collect()` even when NVML is absent."""

    def __init__(self) -> None:
        self._nvml = None
        self._handles: list = []
        self._available = self._try_init()

    def _try_init(self) -> bool:
        try:
            import pynvml  # noqa: WPS433 lazy import
        except ImportError:
            log.warning("pynvml not installed; GPU metrics disabled")
            return False

        try:
            pynvml.nvmlInit()
        except Exception as exc:  # noqa: BLE001
            log.warning("NVML init failed: %s; GPU metrics disabled", exc)
            return False

        self._nvml = pynvml
        try:
            count = pynvml.nvmlDeviceGetCount()
            self._handles = [pynvml.nvmlDeviceGetHandleByIndex(i) for i in range(count)]
            log.info("NVML initialized; detected %d GPU(s)", count)
        except Exception as exc:  # noqa: BLE001
            log.warning("NVML device enumeration failed: %s", exc)
            return False
        return True

    @property
    def available(self) -> bool:
        return self._available

    def shutdown(self) -> None:
        if self._nvml is not None:
            try:
                self._nvml.nvmlShutdown()
            except Exception:  # noqa: BLE001
                pass

    def collect(self) -> list[GpuMetrics]:
        if not self._available:
            return []
        p = self._nvml
        out: list[GpuMetrics] = []
        for idx, h in enumerate(self._handles):
            try:
                out.append(self._collect_one(p, idx, h))
            except Exception as exc:  # noqa: BLE001
                log.debug("GPU %d collection failed: %s", idx, exc)
        return out

    def _collect_one(self, p, idx: int, h) -> GpuMetrics:  # noqa: ANN001
        util = p.nvmlDeviceGetUtilizationRates(h)
        mem = p.nvmlDeviceGetMemoryInfo(h)
        temp = p.nvmlDeviceGetTemperature(h, p.NVML_TEMPERATURE_GPU)

        power_draw_mw = _safe(lambda: p.nvmlDeviceGetPowerUsage(h), 0)
        power_limit_mw = _safe(lambda: p.nvmlDeviceGetEnforcedPowerLimit(h), 0)

        graphics_clock = _safe(
            lambda: p.nvmlDeviceGetClockInfo(h, p.NVML_CLOCK_GRAPHICS), 0
        )
        sm_clock = _safe(lambda: p.nvmlDeviceGetClockInfo(h, p.NVML_CLOCK_SM), 0)
        mem_clock = _safe(lambda: p.nvmlDeviceGetClockInfo(h, p.NVML_CLOCK_MEM), 0)

        pcie_tx = _safe(
            lambda: p.nvmlDeviceGetPcieThroughput(h, p.NVML_PCIE_UTIL_TX_BYTES), 0
        )
        pcie_rx = _safe(
            lambda: p.nvmlDeviceGetPcieThroughput(h, p.NVML_PCIE_UTIL_RX_BYTES), 0
        )

        enc_util = _safe(lambda: p.nvmlDeviceGetEncoderUtilization(h)[0], 0)
        dec_util = _safe(lambda: p.nvmlDeviceGetDecoderUtilization(h)[0], 0)

        fan = _safe(lambda: float(p.nvmlDeviceGetFanSpeed(h)), None)
        pstate = _safe(lambda: int(p.nvmlDeviceGetPerformanceState(h)), None)

        throttle_mask = _safe(
            lambda: p.nvmlDeviceGetCurrentClocksThrottleReasons(h), 0
        )
        reasons = [name for bit, name in THROTTLE_BITS.items() if throttle_mask & bit]

        ecc_c = _safe(
            lambda: p.nvmlDeviceGetTotalEccErrors(
                h,
                p.NVML_MEMORY_ERROR_TYPE_CORRECTED,
                p.NVML_VOLATILE_ECC,
            ),
            0,
        )
        ecc_u = _safe(
            lambda: p.nvmlDeviceGetTotalEccErrors(
                h,
                p.NVML_MEMORY_ERROR_TYPE_UNCORRECTED,
                p.NVML_VOLATILE_ECC,
            ),
            0,
        )

        name = _safe(lambda: _decode(p.nvmlDeviceGetName(h)), f"GPU {idx}")
        uuid = _safe(lambda: _decode(p.nvmlDeviceGetUUID(h)), "")

        return GpuMetrics(
            index=idx,
            uuid=uuid,
            name=name,
            util_gpu_pct=float(util.gpu),
            util_mem_pct=float(util.memory),
            mem_used_bytes=int(mem.used),
            mem_total_bytes=int(mem.total),
            temperature_c=float(temp),
            power_draw_w=power_draw_mw / 1000.0,
            power_limit_w=power_limit_mw / 1000.0,
            graphics_clock_mhz=int(graphics_clock),
            sm_clock_mhz=int(sm_clock),
            memory_clock_mhz=int(mem_clock),
            pcie_tx_kbps=int(pcie_tx),
            pcie_rx_kbps=int(pcie_rx),
            encoder_util_pct=float(enc_util),
            decoder_util_pct=float(dec_util),
            fan_speed_pct=fan,
            performance_state=pstate,
            throttle_reasons=reasons,
            ecc_errors_corrected=int(ecc_c),
            ecc_errors_uncorrected=int(ecc_u),
        )


def _safe(fn, default):  # noqa: ANN001, ANN201
    try:
        return fn()
    except Exception:  # noqa: BLE001
        return default


def _decode(value) -> str:  # noqa: ANN001
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return str(value)
