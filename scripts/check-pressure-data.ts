/**
 * Script pour vérifier les données de pressure en base
 * Usage: tsx scripts/check-pressure-data.ts
 */
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql } from 'drizzle-orm'
import { measurements, sensorStatus } from '../src/db/schema'
import { eq } from 'drizzle-orm'
import pg from 'pg'
import * as dotenv from 'dotenv'
import path from 'path'

// Charger le .env depuis le répertoire backend
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const { Pool } = pg

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || process.env.POSTGRES_USER || 'postgres',
  password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
  database: process.env.DB_NAME || process.env.POSTGRES_DB || 'iot_data',
})

const db = drizzle(pool)

async function checkPressureData() {
  console.log('🔍 Vérification des données de pressure en base...\n')

  try {
    // 1. Compter le nombre total de mesures de pressure
    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(measurements)
      .where(eq(measurements.sensorType, 'pressure'))

    console.log('📊 Total de mesures de pressure:', totalCount[0]?.count || 0)

    // 2. Compter par module
    const byModule = await db
      .select({
        moduleId: measurements.moduleId,
        count: sql<number>`count(*)`,
        firstMeasurement: sql<Date>`min(${measurements.time})`,
        lastMeasurement: sql<Date>`max(${measurements.time})`,
        avgValue: sql<number>`avg(${measurements.value})`,
        minValue: sql<number>`min(${measurements.value})`,
        maxValue: sql<number>`max(${measurements.value})`,
      })
      .from(measurements)
      .where(eq(measurements.sensorType, 'pressure'))
      .groupBy(measurements.moduleId)

    if (byModule.length > 0) {
      console.log('\n📦 Par module:')
      byModule.forEach(module => {
        console.log(`  - ${module.moduleId}:`)
        console.log(`    • Nombre de mesures: ${module.count}`)
        console.log(`    • Première mesure: ${module.firstMeasurement}`)
        console.log(`    • Dernière mesure: ${module.lastMeasurement}`)
        console.log(`    • Moyenne: ${module.avgValue?.toFixed(2)} hPa`)
        console.log(`    • Min: ${module.minValue?.toFixed(2)} hPa`)
        console.log(`    • Max: ${module.maxValue?.toFixed(2)} hPa`)
      })
    } else {
      console.log('\n⚠️  Aucune donnée de pressure trouvée par module')
    }

    // 3. Dernières 10 mesures
    const lastMeasurements = await db
      .select({
        time: measurements.time,
        moduleId: measurements.moduleId,
        value: measurements.value,
      })
      .from(measurements)
      .where(eq(measurements.sensorType, 'pressure'))
      .orderBy(sql`${measurements.time} DESC`)
      .limit(10)

    if (lastMeasurements.length > 0) {
      console.log('\n📈 Dernières 10 mesures:')
      lastMeasurements.forEach(m => {
        console.log(
          `  - ${m.time.toISOString()} | ${m.moduleId} | ${m.value.toFixed(2)} hPa`
        )
      })
    } else {
      console.log('\n⚠️  Aucune mesure récente trouvée')
    }

    // 4. Vérifier dans sensor_status (valeur actuelle)
    const currentStatus = await db
      .select()
      .from(sensorStatus)
      .where(eq(sensorStatus.sensorType, 'pressure'))

    if (currentStatus.length > 0) {
      console.log('\n💡 Valeurs actuelles (sensor_status):')
      currentStatus.forEach(status => {
        console.log(
          `  - ${status.moduleId}: ${status.value?.toFixed(2)} hPa (mis à jour: ${status.updatedAt})`
        )
      })
    } else {
      console.log('\n⚠️  Aucune valeur actuelle dans sensor_status')
    }

    // 5. Comparer avec les autres capteurs
    const allSensors = await db
      .select({
        sensorType: measurements.sensorType,
        count: sql<number>`count(*)`,
        moduleCount: sql<number>`count(distinct ${measurements.moduleId})`,
      })
      .from(measurements)
      .groupBy(measurements.sensorType)
      .orderBy(sql`count(*) DESC`)

    console.log('\n📊 Comparaison avec tous les capteurs:')
    allSensors.forEach(sensor => {
      const isPressure = sensor.sensorType === 'pressure'
      const marker = isPressure ? '👉' : '  '
      console.log(
        `${marker} ${sensor.sensorType}: ${sensor.count} mesures (${sensor.moduleCount} module(s))`
      )
    })

    // 6. Vérifier aussi temperature_bmp
    const tempBmpCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(measurements)
      .where(eq(measurements.sensorType, 'temperature_bmp'))

    console.log('\n🌡️  Mesures temperature_bmp:', tempBmpCount[0]?.count || 0)

    console.log('\n✅ Vérification terminée')
  } catch (error) {
    console.error('❌ Erreur:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

checkPressureData()

