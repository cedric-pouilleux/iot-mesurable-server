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

async function checkMigrations() {
  try {
    await client.connect();
    // Drizzle usually uses __drizzle_migrations or drizzle.migrations
    // Let's try to list tables first to find the migration table
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'drizzle' OR table_schema = 'public'
    `);
    console.log('Tables:', tables.rows.map(r => r.table_name));

    const res = await client.query(`
      SELECT * FROM "drizzle"."__drizzle_migrations"
    `);
    console.log('Migrations:', res.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

checkMigrations();
