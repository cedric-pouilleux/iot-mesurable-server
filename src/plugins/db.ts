import fp from 'fastify-plugin'
import { Pool } from 'pg'
import { NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from '../db/schema'
import { db, pool } from '../db/client'

declare module 'fastify' {
  interface FastifyInstance {
    db: NodePgDatabase<typeof schema>
    pg: Pool
  }
}

export default fp(async fastify => {
  try {
    // Check connection
    const result = await pool.query('SELECT version(), current_database()')
    const version = result.rows[0]?.version || 'Unknown'
    const database = result.rows[0]?.current_database || 'Unknown'
    
    fastify.log.success({
      msg: `✓ [DB] Connected to PostgreSQL`,
      database,
      host: pool.options.host,
      port: pool.options.port,
      version: version.split(' ')[0], // Just "PostgreSQL 14.x"
    })
  } catch (err) {
    fastify.log.error({ msg: '[DB] Connection failed', error: err })
    throw err
  }

  fastify.decorate('db', db)
  fastify.decorate('pg', pool)

  fastify.addHook('onClose', async instance => {
    await instance.pg.end()
    instance.log.info('Database connection closed')
  })
})
