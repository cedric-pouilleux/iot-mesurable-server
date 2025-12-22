import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { SystemRepository } from './systemRepository'
import type { DbSizeResponse, MetricsHistoryResponse } from '../../types/api'
import { MetricsHistoryQuerySchema } from './schema'
import { z } from 'zod'

type MetricsHistoryQuery = z.infer<typeof MetricsHistoryQuerySchema>

export class SystemController {
  private systemRepo: SystemRepository

  constructor(private fastify: FastifyInstance) {
    this.systemRepo = new SystemRepository(fastify.db)
  }

  getDbSize = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const row = await this.systemRepo.getDbSize()
      const response: DbSizeResponse = {
        totalSize: row.total_size,
        totalSizeBytes: parseInt(row.total_size_bytes, 10),
      }
      return response
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      this.fastify.log.error(err)
      throw this.fastify.httpErrors.internalServerError(errorMessage)
    }
  }

  getMetricsHistory = async (
    req: FastifyRequest<{ Querystring: MetricsHistoryQuery }>,
    reply: FastifyReply
  ) => {
    const { days } = req.query

    try {
      const rows = await this.systemRepo.getMetricsHistory(days)

      const history = rows.map(row => ({
        time: row.time instanceof Date ? row.time : new Date(row.time),
        codeSizeKb: row.code_size_kb,
        dbSizeBytes: row.db_size_bytes,
      }))

      const response: MetricsHistoryResponse = {
        history: history,
        count: history.length,
        periodDays: days,
      }
      return response
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      this.fastify.log.error(err)
      throw this.fastify.httpErrors.internalServerError(errorMessage)
    }
  }
}
