import { Client } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config()

const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'iot_data',
})

async function main() {
    await client.connect()

    console.log('=== Recent measurements (last 10 min) ===\n')

    const res = await client.query(`
        SELECT time, hardware_id, sensor_type, value
        FROM measurements
        WHERE module_id = 'air-quality'
        AND time > NOW() - INTERVAL '10 minutes'
        ORDER BY time DESC
        LIMIT 50
    `)

    if (res.rows.length === 0) {
        console.log('No measurements in last 10 minutes!')
    } else {
        console.log(`Found ${res.rows.length} measurements:\n`)
        res.rows.forEach((r: any) => {
            const timeStr = new Date(r.time).toLocaleTimeString('fr-FR')
            console.log(`${timeStr} | ${r.hardware_id}:${r.sensor_type} = ${r.value}`)
        })

        // Count by hardware
        console.log('\n=== Counts by hardware ===')
        const counts: Record<string, number> = {}
        res.rows.forEach(r => {
            counts[r.hardware_id] = (counts[r.hardware_id] || 0) + 1
        })
        Object.entries(counts).forEach(([hw, count]) => {
            console.log(`${hw}: ${count} measurements`)
        })
    }

    await client.end()
}

main().catch(console.error)
