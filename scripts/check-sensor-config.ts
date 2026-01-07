/**
 * Check what modules still exist in sensor_config
 */

import { db } from '../src/db/client'
import { sensorConfig } from '../src/db/schema'
import { sql } from 'drizzle-orm'

async function checkSensorConfig() {
    console.log('🔍 Checking sensor_config table...\n')

    try {
        // Get distinct module IDs
        const modules = await db
            .selectDistinct({ moduleId: sensorConfig.moduleId })
            .from(sensorConfig)
            .orderBy(sensorConfig.moduleId)

        console.log('📋 Modules found in sensor_config:')
        modules.forEach(m => {
            console.log(`   - ${m.moduleId}`)
        })

        console.log(`\n Total: ${modules.length} modules`)

    } catch (error) {
        console.error('❌ Error:', error)
        process.exit(1)
    }

    process.exit(0)
}

checkSensorConfig()
