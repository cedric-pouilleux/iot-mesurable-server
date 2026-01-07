/**
 * Temporary script to apply chipId migration
 * This truncates all tables and adds chip_id column
 */

import { db } from '../src/db/client.js'
import { sql } from 'drizzle-orm'

async function migrate() {
    console.log('🔄 Starting migration: Add chipId column...')

    try {
        // Truncate tables (user approved data loss)
        console.log('🗑️  Truncating tables...')
        await db.execute(sql`TRUNCATE TABLE device_hardware CASCADE`)
        await db.execute(sql`TRUNCATE TABLE device_system_status CASCADE`)
        await db.execute(sql`TRUNCATE TABLE sensor_status CASCADE`)
        await db.execute(sql`TRUNCATE TABLE sensor_config CASCADE`)
        await db.execute(sql`TRUNCATE TABLE measurements CASCADE`)

        // Drop old constraints/indexes
        console.log('🔧 Dropping old constraints...')
        await db.execute(sql`DROP INDEX IF EXISTS measurements_module_id_time_idx`)
        await db.execute(sql`ALTER TABLE measurements DROP CONSTRAINT IF EXISTS measurements_time_module_id_sensor_type_hardware_id_pk`)
        await db.execute(sql`ALTER TABLE sensor_status DROP CONSTRAINT IF EXISTS sensor_status_module_id_sensor_type_pk`)
        await db.execute(sql`ALTER TABLE sensor_config DROP CONSTRAINT IF EXISTS sensor_config_module_id_sensor_type_pk`)
        await db.execute(sql`ALTER TABLE device_hardware DROP CONSTRAINT IF EXISTS device_hardware_pkey`)
        await db.execute(sql`ALTER TABLE device_system_status DROP CONSTRAINT IF EXISTS device_system_status_pkey`)

        // Add chip_id column
        console.log('➕ Adding chip_id column...')
        await db.execute(sql`ALTER TABLE device_system_status ADD COLUMN chip_id text NOT NULL DEFAULT 'PLACEHOLDER'`)
        await db.execute(sql`ALTER TABLE device_hardware ADD COLUMN chip_id text NOT NULL DEFAULT 'PLACEHOLDER'`)
        await db.execute(sql`ALTER TABLE sensor_status ADD COLUMN chip_id text NOT NULL DEFAULT 'PLACEHOLDER'`)
        await db.execute(sql`ALTER TABLE sensor_config ADD COLUMN chip_id text NOT NULL DEFAULT 'PLACEHOLDER'`)
        await db.execute(sql`ALTER TABLE measurements ADD COLUMN chip_id text NOT NULL DEFAULT 'PLACEHOLDER'`)
        await db.execute(sql`ALTER TABLE measurements_hourly ADD COLUMN chip_id text NOT NULL DEFAULT 'PLACEHOLDER'`)

        // Remove default values
        await db.execute(sql`ALTER TABLE device_system_status ALTER COLUMN chip_id DROP DEFAULT`)
        await db.execute(sql`ALTER TABLE device_hardware ALTER COLUMN chip_id DROP DEFAULT`)
        await db.execute(sql`ALTER TABLE sensor_status ALTER COLUMN chip_id DROP DEFAULT`)
        await db.execute(sql`ALTER TABLE sensor_config ALTER COLUMN chip_id DROP DEFAULT`)
        await db.execute(sql`ALTER TABLE measurements ALTER COLUMN chip_id DROP DEFAULT`)
        await db.execute(sql`ALTER TABLE measurements_hourly ALTER COLUMN chip_id DROP DEFAULT`)

        // Add new composite primary keys
        console.log('🔑 Creating new composite primary keys...')
        await db.execute(sql`ALTER TABLE device_system_status ADD CONSTRAINT device_system_status_module_id_chip_id_pk PRIMARY KEY (module_id, chip_id)`)
        await db.execute(sql`ALTER TABLE device_hardware ADD CONSTRAINT device_hardware_module_id_chip_id_pk PRIMARY KEY (module_id, chip_id)`)
        await db.execute(sql`ALTER TABLE sensor_status ADD CONSTRAINT sensor_status_module_id_chip_id_sensor_type_pk PRIMARY KEY (module_id, chip_id, sensor_type)`)
        await db.execute(sql`ALTER TABLE sensor_config ADD CONSTRAINT sensor_config_module_id_chip_id_sensor_type_pk PRIMARY KEY (module_id, chip_id, sensor_type)`)
        await db.execute(sql`ALTER TABLE measurements ADD CONSTRAINT measurements_time_module_id_chip_id_sensor_type_hardware_id_pk PRIMARY KEY (time, module_id, chip_id, sensor_type, hardware_id)`)

        // Create new index
        console.log('📇 Creating new index...')
        await db.execute(sql`CREATE INDEX measurements_module_id_chip_id_time_idx ON measurements (module_id, chip_id, time)`)

        console.log('✅ Migration completed successfully!')
        process.exit(0)
    } catch (error) {
        console.error('❌ Migration failed:', error)
        process.exit(1)
    }
}

migrate()
