import { FastifyPluginAsync } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { desc, and, gte, lte, like, or, eq, sql, inArray } from 'drizzle-orm'
import { systemLogs } from '../../db/schema'

const LogsQuerySchema = z.object({
  category: z.union([
    z.enum(['HARDWARE', 'MQTT', 'DB', 'API', 'WEBSOCKET']),
    z.array(z.enum(['HARDWARE', 'MQTT', 'DB', 'API', 'WEBSOCKET']))
  ]).optional(),
  source: z.enum(['SYSTEM', 'USER']).optional(),
  direction: z.enum(['IN', 'OUT']).optional(),
  moduleId: z.string().optional(),
  level: z.union([
    z.enum(['trace', 'success', 'info', 'warn', 'error', 'fatal']),
    z.array(z.enum(['trace', 'success', 'info', 'warn', 'error', 'fatal']))
  ]).optional(),
  search: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(1000)).default('100'),
  offset: z.string().transform(Number).pipe(z.number().int().min(0)).default('0'),
})

const LogEntrySchema = z.object({
  id: z.string(),
  category: z.string(),
  source: z.string(),
  direction: z.string().nullable(),
  level: z.string(),
  msg: z.string(),
  time: z.date(),
  details: z.record(z.unknown()).nullable(),
})

const LogsResponseSchema = z.object({
  logs: z.array(LogEntrySchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
})

const logsRoutes: FastifyPluginAsync = async fastify => {
  const app = fastify.withTypeProvider<ZodTypeProvider>()

  app.get(
    '/logs',
    {
      schema: {
        tags: ['System'],
        summary: 'Get system logs with filtering',
        querystring: LogsQuerySchema,
        response: {
          200: LogsResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { category, source, direction, moduleId, level, search, startDate, endDate, limit, offset } = request.query

      // Build conditions
      const conditions = []
      if (category) {
        const cats: string[] = Array.isArray(category) ? [...category] : [category]
        if (cats.includes('HARDWARE') && !cats.includes('ESP32')) cats.push('ESP32')
        if (cats.length > 0) {
          conditions.push(inArray(systemLogs.category, cats))
        }
      }
      if (source) {
        conditions.push(eq(systemLogs.source, source))
      }
      if (direction) {
        conditions.push(eq(systemLogs.direction, direction))
      }
      if (moduleId) {
        conditions.push(sql`${systemLogs.details}->>'moduleId' = ${moduleId}`)
      }
      if (level) {
        const lvls = Array.isArray(level) ? level : [level]
        if (lvls.length > 0) {
          conditions.push(inArray(systemLogs.level, lvls))
        }
      }
      if (search) {
        conditions.push(
          or(
            like(systemLogs.msg, `%${search}%`), 
            like(systemLogs.level, `%${search}%`),
            sql`${systemLogs.details}::text ILIKE ${'%' + search + '%'}`
          )
        )
      }
      if (startDate) {
        conditions.push(gte(systemLogs.time, new Date(startDate)))
      }
      if (endDate) {
        conditions.push(lte(systemLogs.time, new Date(endDate)))
      }

      // Get logs
      const logsResult = await fastify.db
        .select()
        .from(systemLogs)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(systemLogs.time))
        .limit(limit)
        .offset(offset)

      // Cast details to proper type
      const logs = logsResult.map(log => ({
        ...log,
        details: log.details as Record<string, unknown> | null,
      }))

      // Get total count
      const totalResult = await fastify.db
        .select({ count: systemLogs.id })
        .from(systemLogs)
        .where(conditions.length > 0 ? and(...conditions) : undefined)

      return {
        logs,
        total: totalResult.length,
        limit,
        offset,
      }
    }
  )

  // Histogram endpoint
  app.get(
    '/logs/histogram',
    {
      schema: {
        tags: ['System'],
        summary: 'Get system logs histogram data',
        querystring: z.object({
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          startDate: z.string().datetime().optional(),
          endDate: z.string().datetime().optional(),
          category: z.union([
            z.enum(['HARDWARE', 'MQTT', 'DB', 'API', 'SYSTEM', 'WEBSOCKET']),
            z.array(z.enum(['HARDWARE', 'MQTT', 'DB', 'API', 'SYSTEM', 'WEBSOCKET']))
          ]).optional(),
          level: z.union([
            z.enum(['trace', 'debug', 'success', 'info', 'warn', 'error', 'fatal']),
            z.array(z.enum(['trace', 'debug', 'success', 'info', 'warn', 'error', 'fatal']))
          ]).optional(),
          search: z.string().optional(),
        }),
        response: {
          200: z.array(
            z.object({
              slot: z.string(), // ISO timestamp of the bucket start
              counts: z.record(z.number()), // category -> count
            })
          ),
        },
      },
    },
    async (request, reply) => {
      const { date, startDate: queryStartDate, endDate: queryEndDate, category, level, search } = request.query
      
      let start: Date
      let end: Date

      if (date) {
        start = new Date(date)
        start.setHours(0, 0, 0, 0)
        end = new Date(date)
        end.setHours(23, 59, 59, 999)
      } else if (queryStartDate && queryEndDate) {
        start = new Date(queryStartDate)
        end = new Date(queryEndDate)
      } else {
        // Default to last 24h
        end = new Date()
        start = new Date(end.getTime() - 24 * 60 * 60 * 1000)
      }

      // Fixed 10-minute buckets as requested
      const bucketSizeSeconds = 600 

      let query = sql`
        SELECT
          floor(extract(epoch from time) / ${bucketSizeSeconds}) * ${bucketSizeSeconds} as bucket,
          category,
          count(*) as count
        FROM system_logs
        WHERE time >= ${start.toISOString()} AND time <= ${end.toISOString()}
      `

      if (category) {
        const cats: string[] = Array.isArray(category) ? [...category] : [category]
        if (cats.includes('HARDWARE') && !cats.includes('ESP32')) cats.push('ESP32')
        if (cats.length > 0) {
          query = sql`${query} AND category IN ${cats}`
        }
      }
      if (level) {
        const lvls = Array.isArray(level) ? level : [level]
        if (lvls.length > 0) {
          query = sql`${query} AND level IN ${lvls}`
        }
      }
      if (search) {
        query = sql`${query} AND (
          msg ILIKE ${`%${search}%`} 
          OR level ILIKE ${`%${search}%`}
          OR details::text ILIKE ${`%${search}%`}
        )`
      }

      query = sql`${query} GROUP BY bucket, category ORDER BY bucket ASC`
      
      const result = await fastify.db.execute(query)

      // Process result into slots
      const buckets: Record<string, Record<string, number>> = {}
      
      // Generate all slots between start and end
      const slotMs = bucketSizeSeconds * 1000
      for (let time = start.getTime(); time <= end.getTime(); time += slotMs) {
        const slotDate = new Date(time)
        buckets[slotDate.toISOString()] = {}
      }

      // Fill in counts from query
      for (const row of result.rows as any[]) {
        const bucketTime = new Date(Number(row.bucket) * 1000)
        const slotKey = bucketTime.toISOString()
        
        if (!buckets[slotKey]) {
          buckets[slotKey] = {}
        }
        
        buckets[slotKey][row.category] = Number(row.count)
      }

      // Convert to array
      const slots = Object.entries(buckets)
        .map(([slot, counts]) => ({
          slot,
          counts,
        }))
        .sort((a, b) => new Date(a.slot).getTime() - new Date(b.slot).getTime())

      return slots
    }
  )

  // Delete all logs
  app.delete(
    '/logs',
    {
      schema: {
        tags: ['System'],
        summary: 'Delete all system logs',
        response: {
          200: z.object({
            message: z.string(),
            deletedCount: z.number(),
          }),
        },
      },
    },
    async (request, reply) => {
      const result = await fastify.db.delete(systemLogs)
      
      return {
        message: 'All logs deleted successfully',
        deletedCount: 0, // Drizzle doesn't return count for delete
      }
    }
  )
}

export default logsRoutes
