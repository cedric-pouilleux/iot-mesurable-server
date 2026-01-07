/**
 * Script to clean old module IDs from the database
 * Removes: module-air-bootstrap, module-esp32-1
 */

import { db } from '../src/db/client'
import {
    deviceSystemStatus,
    deviceHardware,
    sensorStatus,
    sensorConfig
} from '../src/db/schema'
import { inArray } from 'drizzle-orm'

const OLD_MODULE_IDS = ['module-air-bootstrap', 'module-esp32-1']

async function cleanOldModules() {
    console.log('🧹 Cleaning old modules from database...\n')

    try {
        // 1. Delete sensor configs
        console.log('📝 Deleting sensor configurations...')
        const deletedConfigs = await db
            .delete(sensorConfig)
            .where(inArray(sensorConfig.moduleId, OLD_MODULE_IDS))
        console.log(`   ✓ Deleted sensor configs`)

        // 2. Delete sensor status
        console.log('📊 Deleting sensor status...')
        const deletedStatus = await db
            .delete(sensorStatus)
            .where(inArray(sensorStatus.moduleId, OLD_MODULE_IDS))
        console.log(`   ✓ Deleted sensor status`)

        // 3. Delete device hardware
        console.log('💾 Deleting device hardware...')
        const deletedHardware = await db
            .delete(deviceHardware)
            .where(inArray(deviceHardware.moduleId, OLD_MODULE_IDS))
        console.log(`   ✓ Deleted device hardware`)

        // 4. Delete device system status
        console.log('🖥️  Deleting device system status...')
        const deletedDevices = await db
            .delete(deviceSystemStatus)
            .where(inArray(deviceSystemStatus.moduleId, OLD_MODULE_IDS))
        console.log(`   ✓ Deleted device system status`)

        console.log('\n✅ Cleanup complete!')

        // Show remaining modules
        console.log('\n📋 Remaining modules:')
        const remainingModules = await db
            .select()
            .from(deviceSystemStatus)
            .orderBy(deviceSystemStatus.moduleId)

        if (remainingModules.length === 0) {
            console.log('   (none)')
        } else {
            remainingModules.forEach(module => {
                console.log(`   - ${module.moduleId} (${module.moduleType || 'no type'})`)
            })
        }

    } catch (error) {
        console.error('❌ Error during cleanup:', error)
        process.exit(1)
    }

    process.exit(0)
}

cleanOldModules()
