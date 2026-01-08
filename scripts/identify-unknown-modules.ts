#!/usr/bin/env node
/**
 * Script pour identifier les modules ESP32 physiques à débrancher
 * Lit les derniers messages MQTT et affiche les IPs pour localisation
 */

import pkg from 'pg'
const { Pool } = pkg

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/iot_mesurable'
const pool = new Pool({ connectionString })

async function identifyModules() {
    console.log('🔍 Recherche des modules à débrancher...\n')

    try {
        const result = await pool.query(`
      SELECT module_id, chip_id, ip, mac, module_type, updated_at
      FROM device_system_status
      WHERE chip_id = 'UNKNOWN'
      ORDER BY updated_at DESC
    `)

        if (result.rows.length === 0) {
            console.log('✅ Aucun module UNKNOWN trouvé en base !\n')
            return
        }

        console.log(`⚠️  Trouvé ${result.rows.length} modules UNKNOWN:\n`)

        for (const row of result.rows) {
            console.log(`📍 Module: ${row.module_id}`)
            console.log(`   IP: ${row.ip || 'N/A'} ← DÉBRANCHER CE MODULE`)
            console.log(`   MAC: ${row.mac || 'N/A'}`)
            console.log(`   Type: ${row.module_type || 'N/A'}`)
            console.log(`   Dernière mise à jour: ${row.updated_at}`)
            console.log(`   💡 Pour le trouver: ping ${row.ip || 'N/A'}\n`)
        }

        console.log('🔴 ACTION REQUISE:')
        console.log('   1. Localisez ces modules ESP32 par leur IP')
        console.log('   2. DÉBRANCHEZ-LES physiquement')
        console.log('   3. Puis relancez le script de cleanup\n')

    } catch (err) {
        console.error('❌ Erreur:', err instanceof Error ? err.message : err)
    } finally {
        await pool.end()
    }
}

identifyModules()
