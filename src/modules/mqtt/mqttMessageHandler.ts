import type { FastifyInstance } from 'fastify'
import type { MqttMeasurement, DeviceStatusUpdate, WebSocketMqttData } from '../../types/mqtt'
import { MqttRepository } from './mqttRepository'
import { registry } from '../../core/registry'

type TopicParts = {
  moduleId: string
  category: string | null
  sensorType: string | null
  parts: string[]
}

export class MqttMessageHandler {
  // Cache for delta updates - only broadcast if data changed
  private lastBroadcastedPayload: Map<string, string> = new Map()

  constructor(
    private fastify: FastifyInstance,
    private mqttRepo: MqttRepository,
    private measurementBuffer: MqttMeasurement[],
    private statusUpdateBuffer: DeviceStatusUpdate[],
    private onStatusBufferFull: () => Promise<void>,
    private onMeasurementBufferFull: () => Promise<void>
  ) {}

  /**
   * Parse topic structure: module_id/category/sensor_type
   */
  private parseTopic(topic: string): TopicParts | null {
    const parts = topic.split('/')
    if (parts.length < 2) {
      this.fastify.log.debug(`⚠️ Topic ignored (too short): ${topic}`)
      return null
    }

    const moduleId = parts[0]

    // Skip test topics
    if (moduleId.startsWith('home/') || moduleId.startsWith('dev/') || moduleId === 'test-module') {
      return null
    }

    return {
      moduleId,
      category: parts.length > 1 ? parts[1] : null,
      sensorType: parts.length > 2 ? parts[2] : null,
      parts,
    }
  }

  /**
   * Handle system messages (system or system/config)
   */
  private handleSystemMessage(topic: string, payload: string, moduleId: string): boolean {
    if (!topic.endsWith('/system') && !topic.endsWith('/system/config')) {
      return false
    }

    try {
      const metadata = JSON.parse(payload)
      const type = topic.endsWith('/config') ? 'system_config' : 'system'
      this.statusUpdateBuffer.push({ moduleId, type, data: metadata })

      if (this.statusUpdateBuffer.length >= 50) {
        void this.onStatusBufferFull()
      }
      return true
    } catch (e) {
      this.fastify.log.warn(`⚠️ Failed to parse system message from ${topic}: ${e}`)
      return false
    }
  }

  /**
   * Handle sensor status messages
   * Supports two formats:
   * - Legacy flat: {"dht22:temperature":{"status":"ok","value":22.5}, ...}
   * - New nested: {"moduleId":"x","moduleType":"y","sensors":{...}}
   */
  private handleSensorStatusMessage(topic: string, payload: string, moduleId: string): boolean {
    if (!topic.endsWith('/sensors/status')) {
      return false
    }

    try {
      const metadata = JSON.parse(payload)
      
      // Check for new nested format with moduleType
      if (metadata.sensors && typeof metadata.sensors === 'object') {
        // Extract moduleType and persist it via system_config update
        if (metadata.moduleType) {
          this.statusUpdateBuffer.push({ 
            moduleId, 
            type: 'system_config', 
            data: { moduleType: metadata.moduleType } 
          })
        }
        // Use the nested sensors object for sensor status
        this.statusUpdateBuffer.push({ moduleId, type: 'sensors_status', data: metadata.sensors })
      } else {
        // Legacy flat format - use as-is
        this.statusUpdateBuffer.push({ moduleId, type: 'sensors_status', data: metadata })
      }
      return true
    } catch (e) {
      this.fastify.log.warn(`⚠️ Failed to parse sensors/status from ${topic}: ${e}`)
      return false
    }
  }

  /**
   * Handle sensor config messages
   */
  private handleSensorConfigMessage(topic: string, payload: string, moduleId: string): boolean {
    if (!topic.endsWith('/sensors/config')) {
      return false
    }

    try {
      const metadata = JSON.parse(payload)
      this.statusUpdateBuffer.push({ moduleId, type: 'sensors_config', data: metadata })
      return true
    } catch (e) {
      this.fastify.log.warn(`⚠️ Failed to parse sensors/config from ${topic}: ${e}`)
      return false
    }
  }

  /**
   * Handle hardware config messages
   */
  private handleHardwareMessage(topic: string, payload: string, moduleId: string): boolean {
    if (!topic.endsWith('/hardware/config')) {
      return false
    }

    try {
      const metadata = JSON.parse(payload)
      this.statusUpdateBuffer.push({ moduleId, type: 'hardware', data: metadata })
      return true
    } catch (e) {
      this.fastify.log.warn(`⚠️ Failed to parse hardware/config from ${topic}: ${e}`)
      return false
    }
  }

  /**
   * Handle device log messages
   */
  private handleDeviceLog(topic: string, payload: string, moduleId: string): boolean {
    if (!topic.endsWith('/logs')) {
      return false
    }

    try {
      const logEntry = JSON.parse(payload)
      const { level, msg, time } = logEntry

      // Log to console to trace the flow (bypasses Pino to ensure we see it)
      // Log to console removed
      // console.log(\`[MQTT DEBUG] ...\`)

      const logData = {
        msg: `[HARDWARE:${moduleId}] ${msg}`,
        direction: 'IN',
        moduleId,
        deviceTime: time,
        source: 'esp32',
      }

      // Use the appropriate Pino method based on the log level
      const logLevel = (level || 'info').toLowerCase()
      // console.log(\`[MQTT DEBUG] Calling Pino method: ${logLevel}\`)
      switch (logLevel) {
        case 'trace':
          this.fastify.log.trace(logData)
          break
        case 'debug':
          this.fastify.log.debug(logData)
          break
        case 'warn':
          this.fastify.log.warn(logData)
          break
        case 'success':
          this.fastify.log.success(logData)
          break
        case 'error':
          this.fastify.log.error(logData)
          break
        case 'fatal':
          this.fastify.log.fatal(logData)
          break
        case 'info':
        default:
          this.fastify.log.info(logData)
          break
      }
      // console.log(\`[MQTT DEBUG] Log sent to Pino successfully\`)
      return true
    } catch (e) {
      console.error(`[MQTT DEBUG] Failed to parse device log from ${topic}:`, e)
      this.fastify.log.warn(`⚠️ [MQTT] Failed to parse device log from ${topic}: ${e}`)
      return false
    }
  }

  /**
   * Validate sensor value to reject aberrant readings.
   * Ranges are now loaded from module manifests via the registry.
   */
  private isValueValid(sensorType: string, value: number): boolean {
    // Get range from registry (loaded from manifests)
    const range = registry.getValidationRange(sensorType)
    
    // Unknown sensor type - allow (backwards compatibility)
    if (!range) return true

    if (value < range.min || value > range.max) {
      this.fastify.log.warn({
        msg: `[MQTT] ⚠️ Aberrant value rejected: ${sensorType}=${value} (valid range: ${range.min}-${range.max})`,
        sensorType,
        value,
        min: range.min,
        max: range.max,
      })
      return false
    }
    return true
  }

  /**
   * Handle sensor measurement messages
   */
  private handleSensorMeasurement(
    topic: string,
    payload: string,
    parsed: TopicParts,
    now: Date
  ): boolean {
    const { moduleId, category, parts } = parsed



    // Format: module_id/hardware_id/measurement (NEW - Hardware-aware format)
    // Example: croissance/dht22/temperature, croissance/bmp280/pressure
    if (parts.length === 3 && category !== 'sensors' && !topic.includes('/status') && !topic.includes('/config')) {
      const hardwareId = parts[1]
      const measurementType = parts[2]
      
      // Canonical sensor key mappings - all hardware uses the same canonical keys
      // The hardware_id is stored separately to track the source
      const canonicalMappings: Record<string, Record<string, string>> = {
        'bmp280': {
          'temperature': 'temperature',  // Now canonical
          'pressure': 'pressure'
        },
        'sht40': {
          'temperature': 'temperature',  // Now canonical (was temp_sht)
          'humidity': 'humidity'         // Now canonical (was hum_sht)
        },
        'dht22': {
          'temperature': 'temperature',
          'humidity': 'humidity'
        },
        'sgp30': {
          'eco2': 'eco2',
          'tvoc': 'tvoc'
        },
        'sgp40': {
          'voc': 'voc'
        },
        'sps30': {
          'pm1': 'pm1',
          'pm25': 'pm25',
          'pm4': 'pm4',
          'pm10': 'pm10'
        },
        'mhz14a': {
          'co2': 'co2'
        },
        'mq7': {
          'co': 'co'
        }
      }
      
      // Look up the canonical key, fallback to original if not found
      const hardwareMap = canonicalMappings[hardwareId]
      const canonicalSensorType = hardwareMap?.[measurementType] ?? measurementType

      const value = parseFloat(payload)
      if (isNaN(value)) {
        return false
      }

      // Validate value range
      if (!this.isValueValid(canonicalSensorType, value)) {
        return true // Message was handled (rejected), don't try other handlers
      }

      this.measurementBuffer.push({ 
        time: now, 
        moduleId, 
        sensorType: canonicalSensorType,
        hardwareId,  // Store the hardware source
        value 
      })

      if (this.measurementBuffer.length >= 100) {
        void this.onMeasurementBufferFull()
      }
      return true
    }



    return false
  }

  /**
   * Prepare WebSocket data for broadcast
   */
  private prepareWebSocketData(
    topic: string,
    payload: string,
    parsed: TopicParts | null,
    now: Date
  ): WebSocketMqttData | null {
    if (!this.fastify.io) {
      return null
    }

    let wsValue: number | null = null
    let wsMetadata: Record<string, unknown> | null = null

    // JSON messages (metadata)
    if (
      topic.endsWith('/system') ||
      topic.endsWith('/system/config') ||
      topic.endsWith('/sensors/status') ||
      topic.endsWith('/sensors/config') ||
      topic.endsWith('/hardware/config')
    ) {
      try {
        const parsed = JSON.parse(payload) as Record<string, unknown>
        
        // Handle nested sensors/status format: {moduleId, moduleType, sensors: {...}}
        if (topic.endsWith('/sensors/status') && parsed.sensors && typeof parsed.sensors === 'object') {
          wsMetadata = parsed.sensors as Record<string, unknown>
        } else {
          wsMetadata = parsed
        }
      } catch {
        // Ignore parse errors
      }
    }
    // Numeric sensor measurements
    // Supports:
    // - Legacy: module_id/sensors (2 parts) or module_id/sensors/sensor_type (3 parts with sensors)
    // - New: module_id/hardware_id/measurement (3 parts with hardware-aware format)
    else if (
      parsed &&
      (parsed.parts.length === 3 && parsed.category && !['sensors', 'system', 'hardware', 'logs'].includes(parsed.category))
    ) {
      const numValue = parseFloat(payload)
      if (!isNaN(numValue)) {
        wsValue = numValue
      }
    }

    if (wsValue === null && wsMetadata === null) {
      return null
    }

    return {
      topic,
      value: wsValue,
      metadata: wsMetadata,
      time: now.toISOString(),
    }
  }

  /**
   * Main handler for MQTT messages
   */
  async handleMessage(topic: string, message: Buffer): Promise<void> {
    const payload = message.toString()
    const now = new Date()
    const parsed = this.parseTopic(topic)

    // Debug: log all /logs topics
    if (topic.endsWith('/logs')) {
      // console.log(
      //   `[MQTT DEBUG] Received message on /logs topic: ${topic}, payload: ${payload.substring(0, 200)}`
      // )
    }

    // Debug logging removed to reduce spam
    /*
    if (topic.includes('/pressure') || topic.includes('/temperature_bmp')) {
      console.log(
        `[MQTT DEBUG] Received message on sensor topic: ${topic}, payload: ${payload}, parsed: ${parsed ? 'OK' : 'FAILED'}`
      )
    }
    */

    if (!parsed) {
      if (topic.endsWith('/logs')) {
        // console.log(`[MQTT DEBUG] Topic ${topic} was rejected by parseTopic`)
      }
      return
    }

    const { moduleId } = parsed

    // Try handlers in order
    if (this.handleSystemMessage(topic, payload, moduleId)) {
      // Handled
    } else if (this.handleSensorStatusMessage(topic, payload, moduleId)) {
      // Handled
    } else if (this.handleSensorConfigMessage(topic, payload, moduleId)) {
      // Handled
    } else if (this.handleHardwareMessage(topic, payload, moduleId)) {
      // Handled
    } else if (this.handleDeviceLog(topic, payload, moduleId)) {
      // Handled
      // console.log(`[MQTT DEBUG] handleDeviceLog returned true for ${topic}`)
    } else if (this.handleSensorMeasurement(topic, payload, parsed, now)) {
      // Handled
    } else {
      if (topic.endsWith('/logs')) {
        // console.log(`[MQTT DEBUG] Topic ${topic} was not handled by any handler`)
      }
      this.fastify.log.info(`⚠️ Topic not processed: ${topic} (parts: ${parsed.parts.join(', ')})`)
    }

    // Broadcast via WebSocket (always emit to keep frontend "alive" status updated)
    const wsData = this.prepareWebSocketData(topic, payload, parsed, now)
    if (wsData && this.fastify.io) {
      const clientCount = this.fastify.io.sockets.sockets.size 
      if (clientCount > 0) {
          // REMOVED DELTA CHECK: We want to send updates even if value is same, 
          // so the frontend knows the sensor is still alive (timestamp refresh).
          // this.lastBroadcastedPayload.set(topic, payload)
          this.fastify.io.emit('mqtt:data', wsData)

      }
    }
  }
}
