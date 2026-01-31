import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'iot_data',
});

async function checkSCD41Data() {
    try {
        await client.connect();

        console.log('=== SCD41 Data Check ===');
        console.log('Period: 2026-01-16 10:09:00 to now\n');

        // Count total measurements
        const countRes = await client.query(`
      SELECT 
        COUNT(*) as count,
        MIN(time) as first_measurement,
        MAX(time) as last_measurement
      FROM measurements 
      WHERE module_id = 'air-quality' 
        AND hardware_id = 'scd41' 
        AND time >= '2026-01-16 10:09:00'
        AND time <= NOW()
    `);

        const row = countRes.rows[0];
        console.log(`Total measurements: ${row.count}`);
        console.log(`First: ${row.first_measurement}`);
        console.log(`Last: ${row.last_measurement}`);

        // Check for large gaps (>10 minutes)
        console.log('\n=== Top 10 Largest Gaps (>10 min) ===');
        const gapsRes = await client.query(`
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
    `);

        if (gapsRes.rows.length === 0) {
            console.log('No gaps > 10 minutes found!');
        } else {
            gapsRes.rows.forEach((row, i) => {
                console.log(`${i + 1}. Gap: ${Math.round(row.gap_minutes)} minutes`);
                console.log(`   From: ${row.gap_start}`);
                console.log(`   To: ${row.gap_end}`);
            });
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

checkSCD41Data();
