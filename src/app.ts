import fastify from 'fastify'
import cors from '@fastify/cors'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import sensible from '@fastify/sensible'
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
  jsonSchemaTransform,
} from 'fastify-type-provider-zod'

// Core
import { registry } from './core/registry'

// Plugins
import dbPlugin from './plugins/db'
import socketPlugin from './plugins/socket'
import mqttPlugin from './plugins/mqtt'

import { dbLoggerStream } from './lib/logger'

// Routes
import devicesRoutes from './modules/devices/routes'
import systemRoutes from './modules/system/routes'

export async function buildApp() {
  const app = fastify({
    logger: {
      stream: dbLoggerStream,
      level: 'trace', // Allow all log levels to be processed
      customLevels: {
        success: 25,
      },
    },
    disableRequestLogging: true, // Disable automatic request logging (too verbose)
  }).withTypeProvider<ZodTypeProvider>()

  // Validation
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  // Sensible (HTTP Errors)
  await app.register(sensible)

  // CORS
  await app.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  })

  // Swagger
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'IoT Backend API',
        description: 'API for IoT Dashboard',
        version: '1.0.0',
      },
      servers: [],
    },
    transform: jsonSchemaTransform,
  })

  await app.register(swaggerUi, {
    routePrefix: '/documentation',
  })

  // Load module manifests (must be before MQTT for validation)
  await registry.loadAll()

  // Core Plugins
  await app.register(dbPlugin)
  await app.register(socketPlugin)
  await app.register(mqttPlugin)

  // Import log retention plugin dynamically
  const logRetentionPlugin = await import('./plugins/log-retention')
  await app.register(logRetentionPlugin.default)

  // Routes
  await app.register(devicesRoutes, { prefix: '/api' })
  await app.register(systemRoutes, { prefix: '/api' })

  // Module types routes (manifests)
  const moduleTypesRoutes = await import('./modules/module-types/routes')
  await app.register(moduleTypesRoutes.default, { prefix: '/api' })

  // Zones routes
  const zonesRoutes = await import('./modules/zones/routes')
  await app.register(zonesRoutes.default, { prefix: '/api' })

  // Import logs routes dynamically
  const logsRoutes = await import('./modules/system/logs-routes')
  await app.register(logsRoutes.default, { prefix: '/api' })

  app.get('/health', async () => {
    return { status: 'ok' }
  })

  return app
}
