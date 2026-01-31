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

async function checkRecentData() {
    try {
        await client.connect();

        console.log('=== Last 20 SCD41 measurements ===\n');

        const res = await client.query(`
      SELECT 
        time,
        module_id,
        chip_id,
        hardware_id,
        sensor_type,
        value
      FROM measurements 
      WHERE module_id = 'air-quality' 
        AND hardware_id = 'scd41'
      ORDER BY time DESC
      LIMIT 20
    `);

        if (res.rows.length === 0) {
            console.log('❌ NO DATA FOUND!');
        } else {
            console.log(`Found ${res.rows.length} recent measurements:\n`);
            res.rows.forEach((row, i) => {
                const ago = Math.round((Date.now() - new Date(row.time).getTime()) / 1000);
                console.log(`${i + 1}. ${row.time} (${ago}s ago)`);
                console.log(`   ${row.sensor_type}=${row.value} | chipId=${row.chip_id}`);
            });
        }

        // Check all modules
        console.log('\n=== All modules in last 5 minutes ===\n');
        const allRes = await client.query(`
      SELECT 
        module_id,
        hardware_id,
        COUNT(*) as count,
        MAX(time) as last_time
      FROM measurements
      WHERE time >= NOW() - INTERVAL '5 minutes'
      GROUP BY module_id, hardware_id
      ORDER BY last_time DESC
    `);

        allRes.rows.forEach(row => {
            const ago = Math.round((Date.now() - new Date(row.last_time).getTime()) / 1000);
            console.log(`${row.module_id}/${row.hardware_id}: ${row.count} measurements, last ${ago}s ago`);
        });

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

checkRecentData();
