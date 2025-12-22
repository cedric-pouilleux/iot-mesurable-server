-- Migration: Add description column to zones table
-- Date: 2024-12-14

-- Add description column
ALTER TABLE zones ADD COLUMN IF NOT EXISTS description TEXT;
