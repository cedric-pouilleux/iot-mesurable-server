import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { DeviceRepository } from './deviceRepository'
import type {
  ModuleListItem,
  ModuleDataResponse,
  DeviceStatus,
  SensorDataPoint,
  ConfigUpdateResponse,
} from '../../types/api'
import type { ModuleConfig } from '../../types/mqtt'
import { ModuleParamsSchema, ModuleConfigSchema, ModuleDataQuerySchema, SensorResetSchema, HardwareEnableSchema, ModuleHistoryQuerySchema } from './schema'
import { z } from 'zod'

type ModuleParams = z.infer<typeof ModuleParamsSchema>
type ModuleConfigBody = z.infer<typeof ModuleConfigSchema>
type ModuleDataQuery = z.infer<typeof ModuleDataQuerySchema>
type ModuleHistoryQuery = z.infer<typeof ModuleHistoryQuerySchema>
type SensorResetBody = z.infer<typeof SensorResetSchema>
type HardwareEnableBody = z.infer<typeof HardwareEnableSchema>

export class DeviceController {
  private deviceRepo: DeviceRepository

  constructor(private fastify: FastifyInstance) {
    this.deviceRepo = new DeviceRepository(fastify.db)
  }

  listModules = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const rows = await this.deviceRepo.getAllModules()
      const modules: ModuleListItem[] = rows.map(row => {
        const id = row.moduleId
        const name = id.split('/').pop() || id
        return { id, name, type: 'unknown', status: null }
      })
      return modules
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      this.fastify.log.error(`Error fetching modules: ${errorMessage}`)
      throw this.fastify.httpErrors.internalServerError('Failed to fetch modules')
    }
  }

  updateConfig = async (
    req: FastifyRequest<{ Params: ModuleParams; Body: ModuleConfigBody }>,
    reply: FastifyReply
  ) => {
    const { id } = req.params
    const config: ModuleConfig = req.body

    try {
      if (config.sensors) {
        const queries = Object.entries(config.sensors).map(([sensorType, sensorConfig]) => {
          const interval = sensorConfig?.interval
          if (interval !== undefined) {
            return this.deviceRepo.updateSensorConfig(id, sensorType, interval)
          }
          return Promise.resolve()
        })
        await Promise.all(queries)
      }

      // Publish to MQTT
      const published = this.fastify.publishConfig(id, config)

      if (published) {
        // Build detailed changes summary for the log message
        const changesSummary = Object.entries(config.sensors || {})
          .map(([sensor, cfg]) => `${sensor}=${cfg.interval}s`)
          .join(', ')
        this.fastify.log.info({ msg: `[API] Config modifiée [${id}]: ${changesSummary}`, source: 'USER', moduleId: id, changes: config.sensors })
        const response: ConfigUpdateResponse = {
          success: true,
          message: 'Configuration updated and published',
        }
        return response
      } else {
        this.fastify.log.error({ msg: `[API] Échec modification configuration`, source: 'USER', moduleId: id, error: 'Failed to publish' })
        throw this.fastify.httpErrors.internalServerError('Failed to publish configuration')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      this.fastify.log.error({ msg: `[API] Échec modification configuration`, source: 'USER', moduleId: id, error: errorMessage })
      throw this.fastify.httpErrors.internalServerError(errorMessage)
    }
  }

  resetSensor = async (
    req: FastifyRequest<{ Params: ModuleParams; Body: SensorResetBody }>,
    reply: FastifyReply
  ) => {
    const { id } = req.params
    const { sensor } = req.body

    try {
      const published = this.fastify.publishReset(id, sensor)

      if (published) {
        this.fastify.log.info({ msg: `[API] Reset capteur demandé`, source: 'USER', moduleId: id, sensor })
        return {
          success: true,
          message: `Reset command sent for sensor ${sensor}`,
        }
      } else {
        this.fastify.log.error({ msg: `[API] Échec reset capteur`, source: 'USER', moduleId: id, sensor, error: 'Failed to publish' })
        throw this.fastify.httpErrors.internalServerError('Failed to publish reset command')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      this.fastify.log.error({ msg: `[API] Échec reset capteur`, source: 'USER', moduleId: id, sensor, error: errorMessage })
      throw this.fastify.httpErrors.internalServerError(errorMessage)
    }
  }

  enableHardware = async (
    req: FastifyRequest<{ Params: ModuleParams; Body: HardwareEnableBody }>,
    reply: FastifyReply
  ) => {
    const { id } = req.params
    const { hardware, enabled } = req.body

    try {
      // Publish enable command to MQTT
      const topic = `${id}/sensors/enable`
      const payload = JSON.stringify({ hardware, enabled })
      const published = this.fastify.mqtt.publish(topic, payload)

      if (published) {
        this.fastify.log.info({ 
          msg: `[API] Hardware ${enabled ? 'enabled' : 'disabled'}`, 
          source: 'USER', 
          moduleId: id, 
          hardware, 
          enabled 
        })
        return {
          success: true,
          message: `${hardware} ${enabled ? 'enabled' : 'disabled'}`,
        }
      } else {
        this.fastify.log.error({ 
          msg: `[API] Failed to publish hardware enable command`, 
          source: 'USER', 
          moduleId: id, 
          hardware 
        })
        throw this.fastify.httpErrors.internalServerError('Failed to publish enable command')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      this.fastify.log.error({ 
        msg: `[API] Failed to enable/disable hardware`, 
        source: 'USER', 
        moduleId: id, 
        hardware, 
        error: errorMessage 
      })
      throw this.fastify.httpErrors.internalServerError(errorMessage)
    }
  }

  updatePreferences = async (
    req: FastifyRequest<{ Params: ModuleParams; Body: Record<string, any> }>,
    reply: FastifyReply
  ) => {
    const { id } = req.params
    const preferences = req.body

    try {
      await this.deviceRepo.updatePreferences(id, preferences)
      this.fastify.log.info({ msg: `[API] Préférences modifiées`, source: 'USER', moduleId: id, preferences })
      return {
        success: true,
        message: 'Preferences updated',
        preferences: preferences,
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      this.fastify.log.error({ msg: `[API] Échec modification préférences`, source: 'USER', moduleId: id, error: errorMessage })
      throw this.fastify.httpErrors.internalServerError(errorMessage)
    }
  }

  removeFromZone = async (
    req: FastifyRequest<{ Params: ModuleParams }>,
    reply: FastifyReply
  ) => {
    const { id } = req.params

    try {
      await this.deviceRepo.removeFromZone(id)
      this.fastify.log.info({ msg: `[API] Module retiré de sa zone`, source: 'USER', moduleId: id })
      return {
        success: true,
        message: 'Device removed from zone',
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      this.fastify.log.error({ msg: `[API] Échec retrait module de zone`, source: 'USER', moduleId: id, error: errorMessage })
      throw this.fastify.httpErrors.internalServerError(errorMessage)
    }
  }

  // GET /modules/:id/status - Status only
  getModuleStatus = async (
    req: FastifyRequest<{ Params: ModuleParams }>,
    reply: FastifyReply
  ) => {
    const { id } = req.params
    try {
      return await this.buildStatus(id)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      this.fastify.log.error(`Error fetching status: ${errorMessage}`)
      throw this.fastify.httpErrors.internalServerError('Failed to fetch status')
    }
  }

  // GET /modules/:id/history - Historical sensor data only
  getModuleHistory = async (
    req: FastifyRequest<{ Params: ModuleParams; Querystring: ModuleHistoryQuery }>,
    reply: FastifyReply
  ) => {
    const { id } = req.params
    const { days } = req.query
    try {
      return await this.buildHistory(id, days)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      this.fastify.log.error(`Error fetching history: ${errorMessage}`)
      throw this.fastify.httpErrors.internalServerError('Failed to fetch history')
    }
  }

  // Legacy endpoint - GET /modules/:id/data
  getModuleData = async (
    req: FastifyRequest<{ Params: ModuleParams; Querystring: ModuleDataQuery }>,
    reply: FastifyReply
  ) => {
    const { id } = req.params
    const { days } = req.query
    try {
      const [status, sensors] = await Promise.all([
        this.buildStatus(id),
        this.buildHistory(id, days),
      ])
      return { status, sensors } as ModuleDataResponse
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      this.fastify.log.error(`Error fetching dashboard: ${errorMessage}`)
      throw this.fastify.httpErrors.internalServerError('Failed to fetch dashboard data')
    }
  }

  // GET /modules/:id/storage
  getModuleStorage = async (
    req: FastifyRequest<{ Params: ModuleParams }>,
    reply: FastifyReply
  ) => {
    const { id } = req.params
    try {
      const [storageStats, sensorConfigRows] = await Promise.all([
        this.deviceRepo.getModuleStorageStats(id),
        this.deviceRepo.getSensorConfig(id),
      ])

      const activeSensors = sensorConfigRows.map(row => ({
        sensorType: row.sensorType,
        intervalSeconds: row.intervalSeconds,
        rowCount: 0 
      }))

      if (!storageStats) {
         return {
            rowCount: 0,
            estimatedSizeBytes: 0,
            oldestMeasurement: null,
            newestMeasurement: null,
            activeSensors
         }
      }

      return {
        rowCount: Number(storageStats.row_count),
        estimatedSizeBytes: Number(storageStats.row_count) * 100, // Estimate ~100 bytes/row
        oldestMeasurement: storageStats.oldest_measurement ? new Date(storageStats.oldest_measurement).toISOString() : null,
        newestMeasurement: storageStats.newest_measurement ? new Date(storageStats.newest_measurement).toISOString() : null,
        activeSensors
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      this.fastify.log.error(`Error fetching storage stats: ${errorMessage}`)
      throw this.fastify.httpErrors.internalServerError('Failed to fetch storage stats')
    }
  }

  // --- Private helpers ---

  private async buildStatus(moduleId: string): Promise<DeviceStatus> {
    const [statusRow, sensorStatusRows, sensorConfigRows] = await Promise.all([
      this.deviceRepo.getDeviceStatus(moduleId),
      this.deviceRepo.getSensorStatus(moduleId),
      this.deviceRepo.getSensorConfig(moduleId),
    ])

    const status: DeviceStatus = {}

    if (statusRow) {
      status.system = {
        ip: statusRow.ip,
        mac: statusRow.mac,
        bootedAt: statusRow.bootedAt?.toISOString() ?? null,
        rssi: statusRow.rssi,
        flash: {
          usedKb: statusRow.flashUsedKb,
          freeKb: statusRow.flashFreeKb,
          systemKb: statusRow.flashSystemKb,
        },
        memory: {
          heapTotalKb: statusRow.heapTotalKb,
          heapFreeKb: statusRow.heapFreeKb,
          heapMinFreeKb: statusRow.heapMinFreeKb,
        },
      }

      if (statusRow.chipModel) {
        status.hardware = {
          chip: {
            model: statusRow.chipModel,
            rev: statusRow.chipRev,
            cpuFreqMhz: statusRow.cpuFreqMhz,
            flashKb: statusRow.flashKb,
            cores: statusRow.cores,
          },
        }
        status.preferences = statusRow.preferences || {}
      }
      
      // Add zone name if device is assigned to a zone
      if (statusRow.zoneName) {
        status.zoneName = statusRow.zoneName
      }
      
      // Add module type
      if (statusRow.moduleType) {
        status.moduleType = statusRow.moduleType
      }
    }

    status.sensors = {}
    sensorStatusRows.forEach(row => {
      status.sensors![row.sensorType] = {
        status: row.status ?? 'unknown',
        value: row.value,
      }
    })

    status.sensorsConfig = { sensors: {} }
    sensorConfigRows.forEach(row => {
      status.sensorsConfig!.sensors[row.sensorType] = {
        interval: row.intervalSeconds,
        model: row.model,
      }
    })

    return status
  }

  private async buildHistory(moduleId: string, days: number) {
    const historyRows = await this.deviceRepo.getHistoryData(moduleId, days)
    
    const sensors: Record<string, SensorDataPoint[]> = {}

    historyRows.forEach(row => {
      const dataPoint: SensorDataPoint = { time: row.time, value: row.value }
      
      // Use composite key: hardware_id:sensor_type (normalized to lowercase)
      const sensorTypeLow = row.sensorType.toLowerCase()
      let key = sensorTypeLow
      
      if (row.hardwareId && row.hardwareId !== 'unknown') {
        key = `${row.hardwareId.toLowerCase()}:${sensorTypeLow}`
      }
      if (!sensors[key]) {
        sensors[key] = []
      }
      sensors[key].push(dataPoint)
    })

    return sensors
  }

  /**
   * Delete a module and all its related data
   */
  deleteModule = async (
    req: FastifyRequest<{ Params: ModuleParams }>,
    reply: FastifyReply
  ) => {
    const { id } = req.params

    try {
      const result = await this.deviceRepo.deleteModule(id)
      this.fastify.log.info(`🗑️ Module ${id} deleted (tables: ${result.deletedTables.join(', ')})`)
      return { success: true, message: `Module ${id} deleted`, ...result }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      this.fastify.log.error(`Error deleting module ${id}: ${errorMessage}`)
      throw this.fastify.httpErrors.internalServerError('Failed to delete module')
    }
  }
}
