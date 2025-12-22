import { FastifyPluginAsync } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { DeviceController } from './controller'
import {
  ModuleConfigSchema,
  ModuleParamsSchema,
  ModuleDataQuerySchema,
  ModuleListResponseSchema,
  ModuleDataResponseSchema,
  ConfigUpdateResponseSchema,
  SensorResetSchema,
  HardwareEnableSchema,
  ModuleStatusResponseSchema,
  ModuleHistoryQuerySchema,
  ModuleHistoryResponseSchema,
  PreferencesSchema,
  UpdatePreferencesResponseSchema,
  ModuleStorageResponseSchema,
} from './schema'

const devicesRoutes: FastifyPluginAsync = async fastify => {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const controller = new DeviceController(fastify)

  // GET /modules - List all modules
  app.get(
    '/modules',
    {
      schema: {
        tags: ['Devices'],
        summary: 'List all modules',
        response: {
          200: ModuleListResponseSchema,
        },
      },
    },
    controller.listModules
  )

  // POST /modules/:id/config - Update module configuration
  app.post(
    '/modules/:id/config',
    {
      schema: {
        tags: ['Devices'],
        summary: 'Update module sensor configuration',
        params: ModuleParamsSchema,
        body: ModuleConfigSchema,
        response: {
          200: ConfigUpdateResponseSchema,
        },
      },
    },
    controller.updateConfig
  )

  // POST /modules/:id/reset-sensor - Reset a specific sensor
  app.post(
    '/modules/:id/reset-sensor',
    {
      schema: {
        tags: ['Devices'],
        summary: 'Reset a specific sensor',
        params: ModuleParamsSchema,
        body: SensorResetSchema,
        response: {
          200: ConfigUpdateResponseSchema,
        },
      },
    },
    controller.resetSensor
  )

  // POST /modules/:id/hardware/enable - Enable/disable hardware sensor
  app.post(
    '/modules/:id/hardware/enable',
    {
      schema: {
        tags: ['Devices'],
        summary: 'Enable or disable a hardware sensor',
        params: ModuleParamsSchema,
        body: HardwareEnableSchema,
        response: {
          200: ConfigUpdateResponseSchema,
        },
      },
    },
    controller.enableHardware
  )

  // PATCH /modules/:id/preferences - Update module preferences
  app.patch(
    '/modules/:id/preferences',
    {
      schema: {
        tags: ['Devices'],
        summary: 'Update module preferences',
        params: ModuleParamsSchema,
        body: PreferencesSchema,
        response: {
          200: UpdatePreferencesResponseSchema,
        },
      },
    },
    controller.updatePreferences
  )

  // DELETE /modules/:id/zone - Remove device from zone
  app.delete(
    '/modules/:id/zone',
    {
      schema: {
        tags: ['Devices'],
        summary: 'Remove device from its zone',
        params: ModuleParamsSchema,
        response: {
          200: ConfigUpdateResponseSchema,
        },
      },
    },
    controller.removeFromZone
  )

  // GET /modules/:id/status - Get module status only
  app.get(
    '/modules/:id/status',
    {
      schema: {
        tags: ['Devices'],
        summary: 'Get module status (system, hardware, sensors config)',
        params: ModuleParamsSchema,
        response: {
          200: ModuleStatusResponseSchema,
        },
      },
    },
    controller.getModuleStatus
  )

  // GET /modules/:id/history - Get historical sensor data only
  app.get(
    '/modules/:id/history',
    {
      schema: {
        tags: ['Devices'],
        summary: 'Get historical sensor data',
        params: ModuleParamsSchema,
        querystring: ModuleHistoryQuerySchema,
        response: {
          200: ModuleHistoryResponseSchema,
        },
      },
    },
    controller.getModuleHistory
  )

  // GET /modules/:id/storage - Get module storage stats
  app.get(
    '/modules/:id/storage',
    {
      schema: {
        tags: ['Devices'],
        summary: 'Get module storage statistics and projections',
        params: ModuleParamsSchema,
        response: {
          200: ModuleStorageResponseSchema,
        },
      },
    },
    controller.getModuleStorage
  )

  // GET /modules/:id/data - Legacy: Get module status and time series (kept for compatibility)
  app.get(
    '/modules/:id/data',
    {
      schema: {
        tags: ['Devices'],
        summary: '[Legacy] Get module status and time series measurements',
        params: ModuleParamsSchema,
        querystring: ModuleDataQuerySchema,
        response: {
          200: ModuleDataResponseSchema,
        },
      },
    },
    controller.getModuleData
  )

  // DELETE /modules/:id - Delete a module and all its data
  app.delete(
    '/modules/:id',
    {
      schema: {
        tags: ['Devices'],
        summary: 'Delete a module and all its data',
        params: ModuleParamsSchema,
        response: {
          200: ConfigUpdateResponseSchema,
        },
      },
    },
    controller.deleteModule
  )
}

export default devicesRoutes
