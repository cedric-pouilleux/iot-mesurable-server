-- Migration: Add zones table and device columns for modular architecture
-- Run this migration manually: psql -d your_database -f this_file.sql

-- Create zones table
CREATE TABLE IF NOT EXISTS zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add new columns to device_system_status
ALTER TABLE device_system_status 
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS module_type TEXT,
  ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES zones(id);

-- Create index for zone lookups
CREATE INDEX IF NOT EXISTS idx_device_zone_id ON device_system_status(zone_id);
