-- =============================================================================
-- Migration: Add hardware_id to measurements table
-- Date: 2024-12-21
-- Description: Reset measurements table with new hardware_id column
-- =============================================================================

-- WARNING: This will DELETE ALL measurement data!
-- Make sure you have a backup if needed.

-- 1. Drop TimescaleDB continuous aggregates that depend on measurements
DROP MATERIALIZED VIEW IF EXISTS measurements_hourly CASCADE;

-- 2. Drop the measurements table (TimescaleDB hypertable)
DROP TABLE IF EXISTS measurements CASCADE;

-- 3. Recreate measurements table with hardware_id column
CREATE TABLE measurements (
    time TIMESTAMPTZ NOT NULL,
    module_id TEXT NOT NULL,
    sensor_type TEXT NOT NULL,      -- Canonical: temperature, humidity, co2, etc.
    hardware_id TEXT NOT NULL,       -- Source hardware: dht22, bmp280, sht40, etc.
    value DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (time, module_id, sensor_type, hardware_id)
);

-- 4. Convert to TimescaleDB hypertable
SELECT create_hypertable('measurements', 'time', if_not_exists => TRUE);

-- 5. Create index for efficient queries
CREATE INDEX IF NOT EXISTS measurements_module_id_time_idx 
    ON measurements (module_id, time DESC);

-- 6. Recreate the continuous aggregate for hourly data
CREATE MATERIALIZED VIEW measurements_hourly
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 hour', time) AS bucket,
    module_id,
    sensor_type,
    AVG(value) AS avg_value,
    MIN(value) AS min_value,
    MAX(value) AS max_value,
    COUNT(*) AS count
FROM measurements
GROUP BY bucket, module_id, sensor_type
WITH NO DATA;

-- 7. Add refresh policy for continuous aggregate (refresh every hour, covering last 3 hours)
SELECT add_continuous_aggregate_policy('measurements_hourly',
    start_offset => INTERVAL '3 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);

-- 8. Also clean up sensor_status and sensor_config tables (optional, keep if you want device configs)
-- TRUNCATE sensor_status;
-- TRUNCATE sensor_config;

-- Done!
SELECT 'Migration complete! measurements table recreated with hardware_id column.' AS status;
