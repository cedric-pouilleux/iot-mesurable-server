import fp from 'fastify-plugin'
import mqtt from 'mqtt'
import { config } from '../config/env'
import { FastifyInstance } from 'fastify'
import { MqttRepository } from '../modules/mqtt/mqttRepository'
import { MqttMessageHandler } from '../modules/mqtt/mqttMessageHandler'
import type {
  MqttMeasurement,
  DeviceStatusUpdate,
  ModuleConfig,
  SystemData,
  SystemConfigData,
  SensorsStatusData,
  SensorsConfigData,
  HardwareData,
} from '../types/mqtt'

declare module 'fastify' {
  interface FastifyInstance {
    mqtt: mqtt.MqttClient
    publishConfig: (moduleId: string, config: ModuleConfig) => boolean
    publishReset: (moduleId: string, sensor: string) => boolean
  }
}

export default fp(async (fastify: FastifyInstance) => {
  const client = mqtt.connect(config.mqtt.broker)
  const mqttRepo = new MqttRepository(fastify.db)

  // --- BUFFERING SYSTEM ---
  const measurementBuffer: MqttMeasurement[] = []
  const statusUpdateBuffer: DeviceStatusUpdate[] = []
  const FLUSH_INTERVAL = 5000

  async function flushMeasurements() {
    fastify.log.info(`[DEBUG FLUSH] Called with ${measurementBuffer.length} measurements in buffer`)

    if (measurementBuffer.length === 0) {
      return
    }

    const allMeasurements = [...measurementBuffer]
    measurementBuffer.length = 0

    // Use moduleId as chipId fallback for UNKNOWN to prevent data loss
    // This happens when measurements arrive before system/config message
    const batch = allMeasurements.map(m => {
      const originalChipId = m.chipId
      const finalChipId = m.chipId !== 'UNKNOWN' ? m.chipId : m.moduleId

      // Debug: log if fallback is used
      if (originalChipId === 'UNKNOWN') {
        fastify.log.info(`[DEBUG] ChipId fallback: ${m.moduleId}/${m.hardwareId}:${m.sensorType} - UNKNOWN -> ${finalChipId}`)
      }

      return {
        ...m,
        chipId: finalChipId
      }
    })

    if (batch.length === 0) {
      return
    }

    // Group by device for better logging
    const byDevice = batch.reduce((acc, m) => {
      if (!acc[m.moduleId]) acc[m.moduleId] = []
      acc[m.moduleId].push(m)
      return acc
    }, {} as Record<string, typeof batch>)

    const deviceSummaries = Object.entries(byDevice).map(([moduleId, measurements]) => {
      const sensors = measurements.map(m => `${m.sensorType}=${m.value}`).join(', ')
      return `${moduleId} (${measurements.length}: ${sensors})`
    })

    // Log MQTT reception before DB insertion
    for (const [moduleId, measurements] of Object.entries(byDevice)) {
      const details = measurements.map(m => {
        const key = m.hardwareId && m.hardwareId !== 'unknown'
          ? `${m.hardwareId}:${m.sensorType}`
          : m.sensorType
        return `${key}=${m.value}`
      })

      fastify.log.info({
        msg: `Received ${measurements.length} measurements via MQTT: ${moduleId}`,
        category: 'MQTT',
        source: 'SYSTEM',
        direction: 'IN',
        moduleId,
        count: measurements.length,
        details: details,
      })
    }

    try {
      await mqttRepo.insertMeasurementsBatch(batch)

      // Log one entry per module with moduleId in details
      for (const [moduleId, measurements] of Object.entries(byDevice)) {
        const details = measurements.map(m => {
          const key = m.hardwareId && m.hardwareId !== 'unknown'
            ? `${m.hardwareId}:${m.sensorType}`
            : m.sensorType
          return `${key}=${m.value}`
        })

        fastify.log.info({
          msg: `Inserted ${measurements.length} measurements: ${moduleId}`,
          category: 'DB',
          source: 'SYSTEM',
          moduleId,
          count: measurements.length,
          details: details,
        })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'

      // Log one error per module
      for (const [moduleId, measurements] of Object.entries(byDevice)) {
        fastify.log.error({
          msg: `[DB] Batch insert failed: ${errorMessage}`,
          category: 'DB',
          source: 'SYSTEM',
          moduleId,
          error: errorMessage,
          count: measurements.length,
        })
      }

      // NOTE: We intentionally do NOT retry failed batches.
      // Retrying causes infinite loops when there's a persistent DB issue.
      // The measurements are lost, but the system remains stable.
    }
  }

  async function flushStatusUpdates() {
    if (statusUpdateBuffer.length === 0) return

    const allUpdates = [...statusUpdateBuffer]
    statusUpdateBuffer.length = 0

    // Map updates to ensure valid chipId
    const batch = allUpdates.map(u => {
      // If chipId is UNKNOWN, fallback to moduleId (1:1 mapping assumption for legacy/simple modules)
      if (u.chipId === 'UNKNOWN') {
        // If the message itself contains chipId (system_config), use it
        if (u.type === 'system_config' && (u.data as any)?.chipId) {
          return { ...u, chipId: (u.data as any).chipId }
        }
        // Otherwise fallback to moduleId
        return { ...u, chipId: u.moduleId }
      }
      return u
    })

    const skipped = allUpdates.length - batch.length
    if (skipped > 0) {
      fastify.log.debug({
        msg: `Skipped ${skipped} status updates with UNKNOWN chipId`,
        category: 'MQTT',
        source: 'SYSTEM'
      })
    }

    for (const update of batch) {
      try {
        // For system_config with chipId in payload, use that chipId
        if (update.type === 'system_config' && (update.data as any)?.chipId) {
          update.chipId = (update.data as any).chipId
        }
        await handleDeviceStatusUpdate(mqttRepo, update)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        fastify.log.error(`❌ Status Update Error: ${errorMessage}`)
      }
    }
  }

  // Flush périodique toutes les 5 secondes
  const flushMeasurementsInterval = setInterval(() => {
    void flushMeasurements()
  }, FLUSH_INTERVAL)

  // Flush des status updates toutes les 2.5 secondes
  const flushStatusUpdatesInterval = setInterval(() => {
    void flushStatusUpdates()
  }, FLUSH_INTERVAL / 2)

  client.on('connect', () => {
    const subscribedTopics = ['#'] // We subscribe to all topics
    client.subscribe('#', err => {
      if (err) {
        fastify.log.error({ msg: '[MQTT] Subscription failed', error: err })
      } else {
        fastify.log.success({
          msg: '✓ [MQTT] Connected to broker and subscribed',
          broker: config.mqtt.broker,
          topics: subscribedTopics,
          wildcardSubscription: true,
        })
      }
    })
    republishAllConfigs(fastify, mqttRepo)
  })

  client.on('error', err => {
    fastify.log.error({
      msg: '[MQTT] Connection error',
      error: err.message,
      broker: config.mqtt.broker,
    })
  })

  const messageHandler = new MqttMessageHandler(
    fastify,
    mqttRepo,
    measurementBuffer,
    statusUpdateBuffer,
    async () => {
      await flushStatusUpdates()
    },
    async () => {
      await flushMeasurements()
    }
  )

  client.on('message', async (topic, message) => {
    await messageHandler.handleMessage(topic, message)
  })

  fastify.decorate('mqtt', client)
  fastify.decorate('publishConfig', (moduleId: string, config: ModuleConfig) => {
    if (!client) return false
    const topic = `${moduleId}/sensors/config`
    const payload = JSON.stringify(config)
    fastify.log.info({
      msg: `[MQTT] Publishing config to ${topic}`,
      payload: config,
      direction: 'OUT'
    })
    client.publish(topic, payload, { retain: true, qos: 1 })
    return true
  })

  fastify.decorate('publishReset', (moduleId: string, sensor: string) => {
    if (!client) return false
    const topic = `${moduleId}/sensors/reset`
    const payload = JSON.stringify({ sensor })
    client.publish(topic, payload, { qos: 1 })
    fastify.log.success({
      msg: `✓ [MQTT] Reset sent to ${moduleId}: ${sensor}`,
      direction: 'OUT',
      moduleId,
      sensor
    })
    return true
  })

  fastify.addHook('onClose', async (instance) => {
    clearInterval(flushMeasurementsInterval)
    clearInterval(flushStatusUpdatesInterval)

    try {
      // Attempt to flush remaining data
      // Note: This might fail if the DB connection is already closed by dbPlugin
      await Promise.allSettled([
        flushMeasurements(),
        flushStatusUpdates()
      ])
    } catch (err) {
      instance.log.warn('[MQTT] Flush on close failed (likely DB closed)')
    }

    if (client) {
      client.end()
    }
  })
})

async function handleDeviceStatusUpdate(
  mqttRepo: MqttRepository,
  update: DeviceStatusUpdate
): Promise<void> {
  const { moduleId, chipId, type, data } = update

  switch (type) {
    case 'system':
      await mqttRepo.updateSystemStatus(moduleId, chipId, data as SystemData)
      break
    case 'system_config':
      await mqttRepo.updateSystemConfig(moduleId, chipId, data as SystemConfigData)
      break
    case 'sensors_status':
      await mqttRepo.updateSensorStatus(moduleId, chipId, data as SensorsStatusData)
      break
    case 'sensors_config':
      await mqttRepo.updateSensorConfig(moduleId, chipId, data as SensorsConfigData)
      break
    case 'hardware':
      await mqttRepo.updateHardware(moduleId, chipId, data as HardwareData)
      break
  }
}

async function republishAllConfigs(
  fastify: FastifyInstance,
  mqttRepo: MqttRepository
): Promise<void> {
  try {
    const configsByModule = await mqttRepo.getEnabledSensorConfigs()

    // Publish configs (convert composite keys to hardware keys for firmware)
    for (const [moduleId, config] of Object.entries(configsByModule)) {
      // Convert composite keys format to hardware format
      const mqttConfig: ModuleConfig = { sensors: {} }
      const hardwareIntervals = new Map<string, number>()

      if (config.sensors) {
        for (const [key, sensorConfig] of Object.entries(config.sensors)) {
          const interval = sensorConfig?.interval
          if (interval === undefined) continue

          // Extract hardware key from composite key (scd41:co2 -> scd41)
          const hardwareKey = key.includes(':') ? key.split(':')[0] : key
          hardwareIntervals.set(hardwareKey, interval)
        }

        // Build hardware-level config for MQTT
        for (const [hardwareKey, interval] of hardwareIntervals) {
          mqttConfig.sensors![hardwareKey] = { interval }
        }
      }

      fastify.publishConfig(moduleId, mqttConfig)
    }

    const moduleIds = Object.keys(configsByModule)
    fastify.log.info({
      msg: `[MQTT] Republished configs for ${moduleIds.length} modules: ${moduleIds.join(', ')}`,
      count: moduleIds.length,
      modules: moduleIds,
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    fastify.log.error({
      msg: '[MQTT] Error republishing configs',
      error: errorMessage,
    })
  }
}
