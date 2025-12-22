-- Log Retention Policy for system_logs table
-- This script deletes logs older than 7 days
-- Run this periodically via cron or on backend startup

DELETE FROM system_logs
WHERE time < NOW() - INTERVAL '7 days';

-- Optional: Analyze the table after deletion to reclaim space
ANALYZE system_logs;
