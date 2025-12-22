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

async function checkConstraints() {
  try {
    await client.connect();
    
    console.log('--- Constraints ---');
    const constraints = await client.query(`
      SELECT conname, contype, pg_get_constraintdef(oid) 
      FROM pg_constraint 
      WHERE conrelid = 'measurements'::regclass;
    `);
    console.log(constraints.rows);

    console.log('--- Indices ---');
    const indices = await client.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'measurements';
    `);
    console.log(indices.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

checkConstraints();
