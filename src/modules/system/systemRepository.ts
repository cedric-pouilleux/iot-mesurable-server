import { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { sql } from 'drizzle-orm'
import * as schema from '../../db/schema'

export class SystemRepository {
  constructor(private db: NodePgDatabase<typeof schema>) {}

  async getDbSize() {
    const result = await this.db.execute<{
      total_size: string
      total_size_bytes: string
    }>(sql`
            SELECT pg_size_pretty(pg_database_size(current_database())) as total_size,
                   pg_database_size(current_database()) as total_size_bytes
        `)
    return result.rows[0]
  }

  async getMetricsHistory(days: number) {
    const result = await this.db.execute<{
      time: Date
      code_size_kb: number | null
      db_size_bytes: string | number
    }>(sql`
            SELECT 
                time,
                code_size_kb,
                db_size_bytes
            FROM system_metrics
            WHERE time > NOW() - (${days} || ' days')::interval
            ORDER BY time ASC
        `)
    return result.rows
  }
}
