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

async function checkLast5Minutes() {
    try {
        await client.connect();

        console.log('=== Measurements in last 5 minutes ===\n');

        const res = await client.query(`
      SELECT 
        time,
        module_id,
        chip_id,
        hardware_id,
        sensor_type,
        value,
        EXTRACT(EPOCH FROM (NOW() - time)) as seconds_ago
      FROM measurements 
      WHERE time >= NOW() - INTERVAL '5 minutes'
      ORDER BY time DESC
      LIMIT 50
    `);

        if (res.rows.length === 0) {
            console.log('❌ NO MEASUREMENTS IN LAST 5 MINUTES!');
            console.log('This means data is NOT being persisted to database.');
        } else {
            console.log(`Found ${res.rows.length} measurements:\n`);
            res.rows.forEach((row, i) => {
                console.log(`${i + 1}. ${row.module_id}/${row.hardware_id}:${row.sensor_type} = ${row.value}`);
                console.log(`   time: ${row.time} (${Math.round(row.seconds_ago)}s ago)`);
                console.log(`   chipId: ${row.chip_id}`);
            });
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

checkLast5Minutes();
