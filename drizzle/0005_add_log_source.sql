-- Migration: Add source column to system_logs
-- Distinguishes SYSTEM events from USER actions

ALTER TABLE system_logs ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'SYSTEM' NOT NULL;

-- Index for filtering by source
CREATE INDEX IF NOT EXISTS system_logs_source_idx ON system_logs (source);
