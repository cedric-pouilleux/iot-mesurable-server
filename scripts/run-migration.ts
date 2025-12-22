import 'dotenv/config'
import { Pool } from 'pg'

async function migrate() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'iot_data',
    ssl: false
  })
  
  try {
    console.log('Creating zones table...')
    await pool.query(`
      CREATE TABLE IF NOT EXISTS zones (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    
    console.log('Adding name column...')
    await pool.query(`ALTER TABLE device_system_status ADD COLUMN IF NOT EXISTS name TEXT`)
    
    console.log('Adding module_type column...')
    await pool.query(`ALTER TABLE device_system_status ADD COLUMN IF NOT EXISTS module_type TEXT`)
    
    console.log('Adding zone_id column...')
    await pool.query(`ALTER TABLE device_system_status ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES zones(id)`)
    
    console.log('Creating index...')
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_device_zone_id ON device_system_status(zone_id)`)
    
    console.log('✓ Migration completed successfully!')
  } catch (e: any) {
    console.error('✗ Migration failed:', e.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

migrate()
