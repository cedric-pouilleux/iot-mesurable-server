// Script temporaire pour vérifier les données SCD41
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql } from 'drizzle-orm'
import pg from 'pg'

const { Pool } = pg

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
})

const db = drizzle(pool)

const result = await db.execute(sql`
  SELECT 
    COUNT(*) as count,
    MIN(time) as first_measurement,
    MAX(time) as last_measurement,
    COUNT(DISTINCT DATE_TRUNC('hour', time)) as hours_with_data
  FROM measurements 
  WHERE module_id = 'air-quality' 
    AND hardware_id = 'scd41' 
    AND time >= '2026-01-16 10:09:00'
    AND time <= NOW()
`)

console.log('=== SCD41 Data Check ===')
console.log('Period: 2026-01-16 10:09:00 to now')
console.log(result.rows[0])

// Check for gaps
const gaps = await db.execute(sql`
  WITH measurements_with_gaps AS (
    SELECT 
      time,
      LAG(time) OVER (ORDER BY time) as prev_time,
      EXTRACT(EPOCH FROM (time - LAG(time) OVER (ORDER BY time))) / 60 as gap_minutes
    FROM measurements
    WHERE module_id = 'air-quality' 
      AND hardware_id = 'scd41'
      AND sensor_type = 'co2'
      AND time >= '2026-01-16 10:09:00'
    ORDER BY time
  )
  SELECT 
    prev_time as gap_start,
    time as gap_end,
    gap_minutes
  FROM measurements_with_gaps
  WHERE gap_minutes > 10
  ORDER BY gap_minutes DESC
  LIMIT 10
`)

console.log('\n=== Top 10 Largest Gaps (>10 min) ===')
gaps.rows.forEach((row, i) => {
    console.log(`${i + 1}. Gap: ${Math.round(row.gap_minutes)} minutes`)
    console.log(`   From: ${row.gap_start}`)
    console.log(`   To: ${row.gap_end}`)
})

await pool.end()
