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

async function checkDuplicates() {
  try {
    await client.connect();
    
    const res = await client.query(`
      SELECT time, module_id, sensor_type, count(*)
      FROM measurements
      GROUP BY time, module_id, sensor_type
      HAVING count(*) > 1
      LIMIT 10;
    `);
    
    if (res.rows.length > 0) {
      console.log('Duplicates found:', res.rows);
      
      // Count total duplicates
      const countRes = await client.query(`
        SELECT count(*) FROM (
          SELECT time, module_id, sensor_type
          FROM measurements
          GROUP BY time, module_id, sensor_type
          HAVING count(*) > 1
        ) as duplicates;
      `);
      console.log('Total duplicate groups:', countRes.rows[0].count);
    } else {
      console.log('No duplicates found.');
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

checkDuplicates();
