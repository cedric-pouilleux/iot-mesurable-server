#!/usr/bin/env node
/**
 * Clean up UNKNOWN chipId entries from database
 */

import pkg from 'pg'
const { Pool } = pkg

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/iot_mesurable'
const pool = new Pool({ connectionString })

async function cleanup() {
    console.log('🧹 Cleaning up UNKNOWN chipId entries...\n')

    try {
        // Show what will be deleted
        const toDelete = await pool.query(`
      SELECT module_id, chip_id, module_type
      FROM device_system_status
      WHERE chip_id = 'UNKNOWN'
      ORDER BY module_id
    `)

        console.log(`Found ${toDelete.rows.length} entries with chipId='UNKNOWN':\n`)
        for (const row of toDelete.rows) {
            console.log(`  - ${row.module_id} (${row.module_type})`)
        }

        if (toDelete.rows.length === 0) {
            console.log('\n✅ Nothing to clean!')
            return
        }

        console.log('\n🗑️  Deleting entries with chipId=UNKNOWN from all tables...\n')

        // Delete from all tables
        const tables = [
            'measurements',
            'sensor_status',
            'sensor_config',
            'device_hardware',
            'device_system_status'
        ]

        let totalDeleted = 0
        for (const table of tables) {
            const result = await pool.query(`
        DELETE FROM ${table}
        WHERE chip_id = 'UNKNOWN'
      `)
            const count = result.rowCount || 0
            totalDeleted += count
            if (count > 0) {
                console.log(`  ✅ ${table}: deleted ${count} rows`)
            }
        }

        console.log(`\n✅ Total deleted: ${totalDeleted} rows`)
        console.log('\n🎉 Cleanup complete! Refresh your frontend.')

    } catch (err) {
        console.error('❌ Error:', err instanceof Error ? err.message : err)
    } finally {
        await pool.end()
    }
}

cleanup()
