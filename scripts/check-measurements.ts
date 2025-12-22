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
    
    // Check if table exists
    const tableRes = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'measurements'
      );
    `);
    console.log('Table exists:', tableRes.rows[0].exists);

    // Check if it is a hypertable
    const hyperRes = await client.query(`
      SELECT * FROM timescaledb_information.hypertables 
      WHERE hypertable_name = 'measurements'
    `);
    console.log('Is Hypertable:', hyperRes.rows.length > 0);
    
    // Check columns
    const columnsRes = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'measurements';
    `);
    console.log('Columns:', columnsRes.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

check();
