/**
 * Script to list all active modules in the database
 * Shows module IDs, types, and last update times
 */

import { db } from '../src/db/client'
import { deviceSystemStatus } from '../src/db/schema'
import { sql } from 'drizzle-orm'

async function listModules() {
    console.log('📋 Current modules in database:\n')

    try {
        const modules = await db
            .select({
                moduleId: deviceSystemStatus.moduleId,
                moduleType: deviceSystemStatus.moduleType,
                ip: deviceSystemStatus.ip,
                mac: deviceSystemStatus.mac,
                updatedAt: deviceSystemStatus.updatedAt,
            })
            .from(deviceSystemStatus)
            .orderBy(deviceSystemStatus.moduleId)

        if (modules.length === 0) {
            console.log('   (no modules found)')
        } else {
            console.log(`Total: ${modules.length} module(s)\n`)
            modules.forEach(module => {
                const lastUpdate = module.updatedAt
                    ? new Date(module.updatedAt).toLocaleString('fr-FR')
                    : 'never'

                console.log(`📌 ${module.moduleId}`)
                console.log(`   Type: ${module.moduleType || 'unknown'}`)
                console.log(`   IP: ${module.ip || 'unknown'}`)
                console.log(`   MAC: ${module.mac || 'unknown'}`)
                console.log(`   Last update: ${lastUpdate}`)
                console.log('')
            })

            // Group by MAC to detect duplicates
            const macGroups = new Map<string, typeof modules>()
            modules.forEach(m => {
                if (m.mac) {
                    const group = macGroups.get(m.mac) || []
                    group.push(m)
                    macGroups.set(m.mac, group)
                }
            })

            const duplicates = Array.from(macGroups.entries()).filter(([_, mods]) => mods.length > 1)
            if (duplicates.length > 0) {
                console.log('\n⚠️  POTENTIAL DUPLICATES (same MAC address):')
                duplicates.forEach(([mac, mods]) => {
                    console.log(`\nMAC: ${mac}`)
                    mods.forEach(m => console.log(`  - ${m.moduleId}`))
                })
            }
        }
    } catch (error) {
        console.error('❌ Error fetching modules:', error)
        process.exit(1)
    }

    process.exit(0)
}

listModules()
