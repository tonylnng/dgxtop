export interface GpuMetrics {
  index: number;
  uuid: string;
  name: string;
  util_gpu_pct: number;
  util_mem_pct: number;
  mem_used_bytes: number;
  mem_total_bytes: number;
  temperature_c: number;
  power_draw_w: number;
  power_limit_w: number;
  graphics_clock_mhz: number;
  sm_clock_mhz: number;
  memory_clock_mhz: number;
  pcie_tx_kbps: number;
  pcie_rx_kbps: number;
  encoder_util_pct: number;
  decoder_util_pct: number;
  fan_speed_pct: number | null;
  performance_state: number | null;
  throttle_reasons: string[];
  ecc_errors_corrected: number;
  ecc_errors_uncorrected: number;
}

export interface CpuMetrics {
  util_pct: number;
  per_core_pct: number[];
  load_avg_1: number;
  load_avg_5: number;
  load_avg_15: number;
  tasks_running: number;
  tasks_total: number;
  temperature_c: number | null;
  freq_mhz: number | null;
}

export interface MemoryMetrics {
  ram_used_bytes: number;
  ram_total_bytes: number;
  ram_available_bytes: number;
  ram_cached_bytes: number;
  ram_buffers_bytes: number;
  swap_used_bytes: number;
  swap_total_bytes: number;
}

export interface DiskDeviceMetrics {
  device: string;
  mountpoint: string;
  fs_used_bytes: number;
  fs_total_bytes: number;
  fs_free_bytes: number;
  read_bps: number;
  write_bps: number;
  read_iops: number;
  write_iops: number;
}

export interface NetworkInterfaceMetrics {
  name: string;
  rx_bps: number;
  tx_bps: number;
  rx_errors: number;
  tx_errors: number;
  rx_total_bytes: number;
  tx_total_bytes: number;
}

export interface GpuProcess {
  pid: number;
  gpu_index: number;
  user: string;
  proc_type: string;
  gpu_mem_bytes: number;
  gpu_util_pct: number | null;
  cpu_pct: number;
  host_mem_bytes: number;
  command: string;
}

export interface Snapshot {
  timestamp: string;
  gpus: GpuMetrics[];
  cpu: CpuMetrics;
  memory: MemoryMetrics;
  disks: DiskDeviceMetrics[];
  network: NetworkInterfaceMetrics[];
  processes: GpuProcess[];
}

export interface HistoryPoint { ts: string; value: number }
export interface HistorySeries { metric: string; gpu_index: number | null; points: HistoryPoint[] }
