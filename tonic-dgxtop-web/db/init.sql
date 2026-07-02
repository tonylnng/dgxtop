-- TimescaleDB schema for dgxtop-web
-- Runs once on first container start (mounted into /docker-entrypoint-initdb.d/).

CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS metrics (
    ts          TIMESTAMPTZ NOT NULL,
    metric      TEXT        NOT NULL,
    gpu_index   INTEGER,
    device      TEXT,
    value       DOUBLE PRECISION NOT NULL
);

SELECT create_hypertable(
    'metrics', 'ts',
    chunk_time_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);

CREATE INDEX IF NOT EXISTS metrics_metric_ts_idx
    ON metrics (metric, ts DESC);
CREATE INDEX IF NOT EXISTS metrics_metric_gpu_ts_idx
    ON metrics (metric, gpu_index, ts DESC)
    WHERE gpu_index IS NOT NULL;
CREATE INDEX IF NOT EXISTS metrics_metric_device_ts_idx
    ON metrics (metric, device, ts DESC)
    WHERE device IS NOT NULL;

-- 24h retention: drop chunks older than 25h (small buffer).
SELECT add_retention_policy('metrics', INTERVAL '25 hours', if_not_exists => TRUE);

-- Continuous aggregate: 1-minute buckets for cheap long-range queries.
CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_1m
WITH (timescaledb.continuous) AS
SELECT
    time_bucket(INTERVAL '1 minute', ts) AS bucket,
    metric,
    gpu_index,
    device,
    AVG(value) AS avg_value,
    MAX(value) AS max_value,
    MIN(value) AS min_value
FROM metrics
GROUP BY bucket, metric, gpu_index, device
WITH NO DATA;

SELECT add_continuous_aggregate_policy(
    'metrics_1m',
    start_offset => INTERVAL '2 hours',
    end_offset => INTERVAL '1 minute',
    schedule_interval => INTERVAL '1 minute',
    if_not_exists => TRUE
);
