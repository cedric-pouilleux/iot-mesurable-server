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

    console.log('=== All SCD41 related logs (last hour) ===\n')

    const res = await client.query(`
        SELECT time, level, msg 
        FROM system_logs 
        WHERE (msg ILIKE '%scd41%' OR msg ILIKE '%ASC%' OR msg ILIKE '%getDataReadyFlag%' OR msg ILIKE '%auto-recovery%')
        AND time > NOW() - INTERVAL '1 hour'
        ORDER BY time DESC 
        LIMIT 50
    `)

    if (res.rows.length === 0) {
        console.log('No SCD41 logs found')
    } else {
        res.rows.forEach((r: any) => {
            const timeStr = new Date(r.time).toLocaleTimeString('fr-FR')
            console.log(`${timeStr} [${r.level}] ${r.msg}`)
        })
    }

    await client.end()
}

main().catch(console.error)
