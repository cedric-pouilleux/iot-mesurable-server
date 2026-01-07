#!/usr/bin/env node
/**
 * Check for duplicate modules in database
 */

import pkg from 'pg'
const { Pool } = pkg

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/iot_mesurable'
const pool = new Pool({ connectionString })

async function checkDuplicates() {
  console.log('🔍 Checking for duplicate modules...\n')

  try {
    // Get all device_system_status entries
    const result = await pool.query(`
      SELECT module_id, chip_id, module_type, updated_at
      FROM device_system_status
      ORDER BY module_id, chip_id
    `)

    console.log(`📋 Found ${result.rows.length} entries in device_system_status:\n`)

    const byModule = new Map()

    for (const row of result.rows) {
      if (!byModule.has(row.module_id)) {
        byModule.set(row.module_id, [])
      }
      byModule.get(row.module_id).push(row)
    }

    for (const [moduleId, entries] of byModule) {
      console.log(`\n📦 Module: ${moduleId}`)
      console.log(`   Count: ${entries.length} ${entries.length > 1 ? '⚠️  DUPLICATE!' : '✅'}`)

      for (const entry of entries) {
        console.log(`   - chipId: ${entry.chip_id}`)
        console.log(`     type: ${entry.module_type || 'null'}`)
        console.log(`     updated: ${entry.updated_at}`)
      }
    }

    // Check if any chipId is 'UNKNOWN'
    const unknowns = result.rows.filter(r => r.chip_id === 'UNKNOWN')
    if (unknowns.length > 0) {
      console.log(`\n⚠️  Found ${unknowns.length} entries with chipId='UNKNOWN'`)
      console.log('   These are from modules that haven\'t published their real chipId yet')
    }

  } catch (err) {
    console.error('❌ Error:', err instanceof Error ? err.message : err)
  } finally {
    await pool.end()
  }
}

checkDuplicates()
