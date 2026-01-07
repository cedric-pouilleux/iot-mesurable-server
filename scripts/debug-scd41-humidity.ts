import { drizzle } from 'drizzle-orm/node-postgres'
import { Client } from 'pg'
import { sql } from 'drizzle-orm'
import * as dotenv from 'dotenv'

dotenv.config()

const client = new Client({
    connectionString: process.env.DATABASE_URL
})

async function checkSCD41Humidity() {
    await client.connect()
    const db = drizzle(client)

    console.log('\n=== Checking SCD41 Humidity Data ===\n')

    // 1. Check recent measurements for humidity
    console.log('1. Recent humidity measurements from air-quality module:')
    const measurements = await db.execute(sql`
    SELECT module_id, sensor_type, hardware_id, value, time 
    FROM measurements 
    WHERE module_id = 'air-quality' 
      AND sensor_type = 'humidity'
    ORDER BY time DESC 
    LIMIT 10
  `)
    console.log(measurements.rows)

    // 2. Check sensor_status table
    console.log('\n2. Sensor status for scd41 humidity:')
    const sensorStatus = await db.execute(sql`
    SELECT module_id, sensor_type, status, value, updated_at 
    FROM sensor_status 
    WHERE module_id = 'air-quality' 
      AND sensor_type LIKE '%humidity%'
    ORDER BY updated_at DESC
  `)
    console.log(sensorStatus.rows)

    // 3. Check sensor_config table
    console.log('\n3. Sensor config for scd41:')
    const sensorConfig = await db.execute(sql`
    SELECT module_id, sensor_type, interval_seconds, enabled, updated_at 
    FROM sensor_config 
    WHERE module_id = 'air-quality' 
      AND sensor_type LIKE '%scd41%'
    ORDER BY sensor_type
  `)
    console.log(sensorConfig.rows)

    // 4. Check all scd41 sensor types
    console.log('\n4. All SCD41 sensor types in measurements:')
    const allSCD41 = await db.execute(sql`
    SELECT DISTINCT sensor_type, hardware_id, COUNT(*) as count, MAX(time) as last_time
    FROM measurements 
    WHERE module_id = 'air-quality' 
      AND hardware_id = 'scd41'
    GROUP BY sensor_type, hardware_id
    ORDER BY sensor_type
  `)
    console.log(allSCD41.rows)

    await client.end()
}

checkSCD41Humidity().catch(console.error)
