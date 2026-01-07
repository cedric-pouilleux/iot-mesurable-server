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
    if (measurementBuffer.length === 0) {
      return
    }

    const batch = [...measurementBuffer]
    measurementBuffer.length = 0

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

      // Remettre les mesures dans le buffer en cas d'erreur (pour réessayer plus tard)
      measurementBuffer.unshift(...batch)
    }
  }

  async function flushStatusUpdates() {
    if (statusUpdateBuffer.length === 0) return

    const batch = [...statusUpdateBuffer]
    statusUpdateBuffer.length = 0

    for (const update of batch) {
      try {
        await handleDeviceStatusUpdate(mqttRepo, update)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        fastify.log.error(`❌ Status Update Error: ${errorMessage}`)
      }
    }
  }

  // Flush périodique toutes les 5 secondes
  setInterval(() => {
    void flushMeasurements()
  }, FLUSH_INTERVAL)

  // Flush des status updates toutes les 2.5 secondes
  setInterval(() => {
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

  fastify.addHook('onClose', (instance, done) => {
    flushMeasurements()
    flushStatusUpdates()
    client.end()
    done()
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
