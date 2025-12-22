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

async function check() {
  try {
    await client.connect();
    const res = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'system_logs'
      );
    `);
    console.log('Table exists:', res.rows[0].exists);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

check();
