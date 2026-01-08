#!/usr/bin/env node
/**
 * Debug script to test getAllModules directly
 */

import { drizzle } from 'drizzle-orm/node-postgres'
import pkg from 'pg'
const { Pool } = pkg
import * as schema from '../src/db/schema.js'

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/iot_mesurable',
})

const db = drizzle(pool, { schema })

async function testGetAllModules() {
    console.log('🔍 Testing getAllModules() directly...\n')

    try {
        const rows = await db
            .selectDistinct({
                moduleId: schema.deviceSystemStatus.moduleId,
                chipId: schema.deviceSystemStatus.chipId,
                moduleType: schema.deviceSystemStatus.moduleType
            })
            .from(schema.deviceSystemStatus)
            .orderBy(schema.deviceSystemStatus.moduleId, schema.deviceSystemStatus.chipId)

        console.log(`📋 Query returned ${rows.length} rows:\n`)

        for (const row of rows) {
            console.log(`✅ Module:`)
            console.log(`   moduleId: ${row.moduleId}`)
            console.log(`   chipId: ${row.chipId}`)
            console.log(`   moduleType: ${row.moduleType}`)

            // Test encoding
            const compositeId = `${row.moduleId}@${row.chipId}`
            console.log(`   → Composite ID: ${compositeId}\n`)
        }

    } catch (err) {
        console.error('❌ Error:', err instanceof Error ? err.message : err)
        console.error(err)
    } finally {
        await pool.end()
    }
}

testGetAllModules()
