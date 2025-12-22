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

async function reproduce() {
  try {
    await client.connect();
    
    // Check metadata column nullability
    const colRes = await client.query(`
        SELECT column_name, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'measurements' AND column_name = 'metadata';
    `);
    console.log('Metadata column:', colRes.rows);

    // Try a small batch insert
    const query = `
      INSERT INTO "measurements" ("time", "module_id", "sensor_type", "value") 
      VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)
      ON CONFLICT ("time", "module_id", "sensor_type") 
      DO UPDATE SET "value" = EXCLUDED.value
    `;
    
    const params = [
      '2025-12-03T21:12:39.761Z', 'croissance', 'co2', 450,
      '2025-12-03T21:12:39.822Z', 'croissance', 'temperature', 20
    ];

    console.log('Executing query...');
    await client.query(query, params);
    console.log('Insert successful');

  } catch (err) {
    console.error('Insert failed:', err);
  } finally {
    await client.end();
  }
}

reproduce();
