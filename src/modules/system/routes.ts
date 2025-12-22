import { FastifyPluginAsync } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { SystemController } from './controller'
import {
  MetricsHistoryQuerySchema,
  DbSizeResponseSchema,
  MetricsHistoryResponseSchema,
} from './schema'

const systemRoutes: FastifyPluginAsync = async fastify => {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const controller = new SystemController(fastify)

  // GET /db-size
  app.get(
    '/db-size',
    {
      schema: {
        tags: ['System'],
        summary: 'Get database size',
        response: {
          200: DbSizeResponseSchema,
        },
      },
    },
    controller.getDbSize
  )

  // GET /metrics-history
  app.get(
    '/metrics-history',
    {
      schema: {
        tags: ['System'],
        summary: 'Get system metrics history',
        querystring: MetricsHistoryQuerySchema,
        response: {
          200: MetricsHistoryResponseSchema,
        },
      },
    },
    controller.getMetricsHistory
  )
}

export default systemRoutes
