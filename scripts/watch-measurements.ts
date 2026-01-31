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

async function watchMeasurements() {
    try {
        await client.connect();

        console.log('=== Watching measurements (last 60s) ===');
        console.log('Checking every 5 seconds...\n');

        for (let i = 0; i < 12; i++) {  // 12 x 5s = 60s total
            const res = await client.query(`
        SELECT 
          time,
          module_id,
          hardware_id,
          sensor_type,
          value,
          chip_id
        FROM measurements 
        WHERE time >= NOW() - INTERVAL '60 seconds'
        ORDER BY time DESC
        LIMIT 20
      `);

            const now = new Date();
            console.log(`\n[${now.toLocaleTimeString()}] Found ${res.rows.length} measurements in last 60s:`);

            if (res.rows.length === 0) {
                console.log('  ❌ NO DATA');
            } else {
                res.rows.slice(0, 5).forEach((row) => {
                    const ago = Math.round((Date.now() - new Date(row.time).getTime()) / 1000);
                    console.log(`  - ${row.module_id}/${row.hardware_id}:${row.sensor_type} = ${row.value} (${ago}s ago)`);
                });
            }

            if (i < 11) {
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

watchMeasurements();
