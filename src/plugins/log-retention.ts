import fp from 'fastify-plugin'
import { pool } from '../db/client'
import fs from 'fs/promises'
import path from 'path'

export default fp(async fastify => {
  try {
    // Read and execute retention policy SQL
    const retentionSQL = await fs.readFile(
      path.join(__dirname, '../db/retention.sql'),
      'utf-8'
    )
    
    await pool.query(retentionSQL)
    // Silent success - no need to log this every startup
  } catch (err) {
    fastify.log.error({ msg: '[SYSTEM] Failed to apply log retention policy', error: err })
  }
})
