"""Pydantic models for API payloads."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class GpuMetrics(BaseModel):
    index: int
    uuid: str
    name: str
    util_gpu_pct: float
    util_mem_pct: float
    mem_used_bytes: int
    mem_total_bytes: int
    temperature_c: float
    power_draw_w: float
    power_limit_w: float
    graphics_clock_mhz: int
    sm_clock_mhz: int
    memory_clock_mhz: int
    pcie_tx_kbps: int
    pcie_rx_kbps: int
    encoder_util_pct: float
    decoder_util_pct: float
    fan_speed_pct: Optional[float] = None
    performance_state: Optional[int] = None
    throttle_reasons: list[str] = Field(default_factory=list)
    ecc_errors_corrected: int = 0
    ecc_errors_uncorrected: int = 0


class CpuMetrics(BaseModel):
    util_pct: float
    per_core_pct: list[float]
    load_avg_1: float
    load_avg_5: float
    load_avg_15: float
    tasks_running: int
    tasks_total: int
    temperature_c: Optional[float] = None
    freq_mhz: Optional[float] = None


class MemoryMetrics(BaseModel):
    ram_used_bytes: int
    ram_total_bytes: int
    ram_available_bytes: int
    ram_cached_bytes: int
    ram_buffers_bytes: int
    swap_used_bytes: int
    swap_total_bytes: int


class DiskDeviceMetrics(BaseModel):
    device: str
    mountpoint: str
    fs_used_bytes: int
    fs_total_bytes: int
    fs_free_bytes: int
    read_bps: float
    write_bps: float
    read_iops: float
    write_iops: float


class NetworkInterfaceMetrics(BaseModel):
    name: str
    rx_bps: float
    tx_bps: float
    rx_errors: int
    tx_errors: int
    rx_total_bytes: int
    tx_total_bytes: int


class GpuProcess(BaseModel):
    pid: int
    gpu_index: int
    user: str
    proc_type: str  # "C" (compute) or "G" (graphics) or "C+G"
    gpu_mem_bytes: int
    gpu_util_pct: Optional[float] = None
    cpu_pct: float = 0.0
    host_mem_bytes: int = 0
    command: str = ""


class Snapshot(BaseModel):
    timestamp: datetime
    gpus: list[GpuMetrics]
    cpu: CpuMetrics
    memory: MemoryMetrics
    disks: list[DiskDeviceMetrics]
    network: list[NetworkInterfaceMetrics]
    processes: list[GpuProcess]


class HistoryPoint(BaseModel):
    ts: datetime
    value: float


class HistorySeries(BaseModel):
    metric: str
    gpu_index: Optional[int] = None
    points: list[HistoryPoint]
