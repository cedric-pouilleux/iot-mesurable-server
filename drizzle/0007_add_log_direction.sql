-- Migration 0007: Add direction column to system_logs
-- This column was missing in previous migrations but present in schema

ALTER TABLE "system_logs" ADD COLUMN IF NOT EXISTS "direction" text;
