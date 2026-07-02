"""Runtime configuration loaded from environment variables."""
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    """Immutable exporter configuration."""

    poll_interval_sec: float
    postgres_dsn: str
    enable_gpu: bool
    log_level: str
    history_retention_hours: int

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            poll_interval_sec=float(os.getenv("POLL_INTERVAL_SEC", "1.0")),
            postgres_dsn=os.getenv(
                "POSTGRES_DSN",
                "postgresql://dgx:dgx@db:5432/dgxtop",
            ),
            enable_gpu=os.getenv("ENABLE_GPU", "true").lower() == "true",
            log_level=os.getenv("LOG_LEVEL", "info").lower(),
            history_retention_hours=int(os.getenv("HISTORY_RETENTION_HOURS", "24")),
        )


settings = Settings.from_env()
