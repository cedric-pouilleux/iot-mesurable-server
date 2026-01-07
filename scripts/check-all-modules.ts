/**
 * Check all modules in device_system_status
 */

import { db } from '../src/db/client'
import { deviceSystemStatus } from '../src/db/schema'

async function checkModules() {
    console.log('🔍 Checking all tables for modules...\n')

    try {
        const modules = await db
            .select()
            .from(deviceSystemStatus)
            .orderBy(deviceSystemStatus.moduleId)

        console.log('📋 Modules in device_system_status:')
        if (modules.length === 0) {
            console.log('   (none)')
        } else {
            modules.forEach(m => {
                console.log(`   - ${m.moduleId} (type: ${m.moduleType || 'none'}, name: ${m.name || 'none'})`)
            })
        }

        console.log(`\n Total: ${modules.length} modules`)

    } catch (error) {
        console.error('❌ Error:', error)
        process.exit(1)
    }

    process.exit(0)
}

checkModules()
