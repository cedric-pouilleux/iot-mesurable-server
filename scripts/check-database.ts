#!/usr/bin/env node
/**
 * Quick database check
 */

import pkg from 'pg'
const { Pool } = pkg

// Connection string from .env or default
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/iot_mesurable'

const pool = new Pool({ connectionString })

async function check() {
    console.log('🔍 Checking database...\n')

    try {
        // Check tables
        const tables = ['device_system_status', 'sensor_status', 'sensor_config', 'measurements']

        for (const table of tables) {
            const result = await pool.query(`SELECT COUNT(*) as count FROM ${table}`)
            const count = parseInt(result.rows[0].count)
            console.log(`${count === 0 ? '❌' : '✅'} ${table}: ${count} rows`)
        }

        // Test insert
        console.log('\n🧪 Testing insert...')
        await pool.query(`
      INSERT INTO device_system_status (module_id, chip_id, updated_at)
      VALUES ('test', 'TEST123', NOW())
      ON CONFLICT (module_id, chip_id) DO UPDATE SET updated_at = NOW()
    `)
        console.log('✅ Insert works!')

        // Cleanup
        await pool.query(`DELETE FROM device_system_status WHERE module_id = 'test'`)

    } catch (err) {
        console.error('❌ Error:', err instanceof Error ? err.message : err)
    } finally {
        await pool.end()
    }
}

check()
