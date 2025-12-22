-- Add booted_at column for persistent uptime tracking
ALTER TABLE device_system_status 
ADD COLUMN IF NOT EXISTS booted_at TIMESTAMPTZ;
