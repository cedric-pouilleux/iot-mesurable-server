import { db } from '../src/db/client'
import { systemLogs } from '../src/db/schema'
import { eq, desc, sql } from 'drizzle-orm'

async function checkESP32Logs() {
  console.log('🔍 Checking ESP32 logs in database...\n')

  // Check total logs
  const totalLogs = await db.select({ count: sql<number>`count(*)` }).from(systemLogs)
  console.log(`Total logs in database: ${totalLogs[0].count}`)

  // Check ESP32 logs
  const esp32Logs = await db
    .select()
    .from(systemLogs)
    .where(eq(systemLogs.category, 'ESP32'))
    .orderBy(desc(systemLogs.time))
    .limit(10)

  console.log(`\nESP32 logs found: ${esp32Logs.length}`)
  if (esp32Logs.length > 0) {
    console.log('\nLast 10 ESP32 logs:')
    esp32Logs.forEach((log, index) => {
      console.log(`${index + 1}. [${log.level}] ${log.msg.substring(0, 80)}...`)
      console.log(`   Time: ${log.time}, Category: ${log.category}`)
      console.log(`   Details: ${JSON.stringify(log.details)}`)
      console.log('')
    })
  } else {
    console.log('❌ No ESP32 logs found!')
  }

  // Check logs by category
  const logsByCategory = await db
    .select({
      category: systemLogs.category,
      count: sql<number>`count(*)`,
    })
    .from(systemLogs)
    .groupBy(systemLogs.category)

  console.log('\nLogs by category:')
  logsByCategory.forEach(({ category, count }) => {
    console.log(`  ${category}: ${count}`)
  })

  // Check logs by level
  const logsByLevel = await db
    .select({
      level: systemLogs.level,
      count: sql<number>`count(*)`,
    })
    .from(systemLogs)
    .groupBy(systemLogs.level)
    .orderBy(desc(sql<number>`count(*)`))

  console.log('\nLogs by level:')
  logsByLevel.forEach(({ level, count }) => {
    console.log(`  ${level}: ${count}`)
  })

  // Check recent logs with ESP32 in message
  const logsWithESP32 = await db
    .select()
    .from(systemLogs)
    .where(sql`${systemLogs.msg} LIKE '%ESP32%'`)
    .orderBy(desc(systemLogs.time))
    .limit(5)

  console.log(`\nLogs containing "ESP32" in message: ${logsWithESP32.length}`)
  if (logsWithESP32.length > 0) {
    logsWithESP32.forEach((log, index) => {
      console.log(`${index + 1}. [${log.category}/${log.level}] ${log.msg.substring(0, 100)}`)
    })
  }

  process.exit(0)
}

checkESP32Logs().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})




