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

async function addPK() {
  try {
    await client.connect();
    
    console.log('Adding Primary Key...');
    await client.query(`
      ALTER TABLE measurements 
      ADD CONSTRAINT measurements_pk 
      PRIMARY KEY (time, module_id, sensor_type);
    `);
    console.log('Primary Key added successfully.');

  } catch (err) {
    console.error('Error adding PK:', err);
  } finally {
    await client.end();
  }
}

addPK();
