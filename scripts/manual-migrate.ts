import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'iot_data',
});

async function runMigration() {
  try {
    await client.connect();
    const sqlPath = path.join(process.cwd(), 'drizzle', '0002_add_system_logs.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Running SQL:', sql);
    await client.query(sql);
    console.log('Migration applied successfully.');
    
    // Optional: Insert into migrations table if you want to sync drizzle state
    // But be careful with hashes.
    
  } catch (err) {
    console.error('Error applying migration:', err);
  } finally {
    await client.end();
  }
}

runMigration();
