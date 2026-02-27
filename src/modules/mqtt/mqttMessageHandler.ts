import type { FastifyInstance } from 'fastify'
import type { MqttMeasurement, DeviceStatusUpdate, WebSocketMqttData } from '../../types/mqtt'
import { MqttRepository } from './mqttRepository'
import { registry } from '../../core/registry'
import { parseTopic, type TopicParts } from './service'

export class MqttMessageHandler {
  constructor(
    private fastify: FastifyInstance,
    private mqttRepo: MqttRepository,
    private measurementBuffer: MqttMeasurement[],
    private statusUpdateBuffer: DeviceStatusUpdate[],
    private onStatusBufferFull: () => Promise<void>,
    private onMeasurementBufferFull: () => Promise<void>
  ) { }

  /**
   * Handle announce messages: mesurable/{chipId}/announce
   * 
   * Payload: { type: "air-quality", moduleId: "air-quality", firmware: "1.0.0", 
   *            hardware: [{key: "scd41", name: "SCD41", sensors: ["co2", "temperature", "humidity"]}] }
   */
  private handleAnnounceMessage(payload: string, chipId: string): boolean {
    try {
      const data = JSON.parse(payload)
      const moduleType = data.type || data.moduleType || null
      // Always use chipId as moduleId in DB (human name goes in module_type)
      const moduleId = chipId

      this.fastify.log.info({
        msg: `[MQTT] 📡 Device announced: ${chipId} (type: ${moduleType}, moduleId: ${moduleId})`,
        category: 'MQTT',
        source: 'SYSTEM',
        chipId,
        moduleType,
        hardware: data.hardware,
      })

      // Push system_config update with moduleType + chipId
      this.statusUpdateBuffer.push({
        moduleId,
        chipId,
        type: 'system_config',
        data: { moduleType, chipId }
      })

      // Push sensor configs from announce hardware array
      if (Array.isArray(data.hardware)) {
        const sensorConfigs: Record<string, { model?: string; enabled?: boolean }> = {}

        for (const hw of data.hardware) {
          if (hw.key && Array.isArray(hw.sensors)) {
            for (const sensor of hw.sensors) {
              const compositeKey = `${hw.key}:${sensor}`
              sensorConfigs[compositeKey] = {
                model: hw.key,
                enabled: true,
              }
            }
          }
        }

        if (Object.keys(sensorConfigs).length > 0) {
          this.statusUpdateBuffer.push({
            moduleId,
            chipId,
            type: 'sensors_config',
            data: sensorConfigs
          })
        }
      }

      if (this.statusUpdateBuffer.length >= 50) {
        void this.onStatusBufferFull()
      }
      return true
    } catch (e) {
      this.fastify.log.warn(`⚠️ Failed to parse announce from chipId ${chipId}: ${e}`)
      return false
    }
  }

  /**
   * Handle system messages: mesurable/{chipId}/system
   */
  private handleSystemMessage(payload: string, parsed: TopicParts): boolean {
    try {
      const metadata = JSON.parse(payload)
      const { chipId } = parsed
      const moduleId = chipId

      this.statusUpdateBuffer.push({ moduleId, chipId, type: 'system_config', data: { ...metadata, chipId } })

      if (this.statusUpdateBuffer.length >= 50) {
        void this.onStatusBufferFull()
      }
      return true
    } catch (e) {
      this.fastify.log.warn(`⚠️ Failed to parse system message: ${e}`)
      return false
    }
  }

  /**
   * Handle sensor status messages: mesurable/{chipId}/status
   */
  private handleStatusMessage(payload: string, parsed: TopicParts): boolean {
    try {
      const metadata = JSON.parse(payload)
      const { chipId } = parsed
      const moduleId = chipId

      // Check for nested format with moduleType
      if (metadata.sensors && typeof metadata.sensors === 'object') {
        if (metadata.moduleType) {
          this.statusUpdateBuffer.push({
            moduleId,
            chipId,
            type: 'system_config',
            data: { moduleType: metadata.moduleType }
          })
        }
        this.statusUpdateBuffer.push({ moduleId, chipId, type: 'sensors_status', data: metadata.sensors })
      } else {
        this.statusUpdateBuffer.push({ moduleId, chipId, type: 'sensors_status', data: metadata })
      }
      return true
    } catch (e) {
      this.fastify.log.warn(`⚠️ Failed to parse status: ${e}`)
      return false
    }
  }

  /**
   * Handle sensor config messages: mesurable/{chipId}/config
   */
  private handleConfigMessage(payload: string, parsed: TopicParts): boolean {
    try {
      const metadata = JSON.parse(payload)
      const { chipId } = parsed
      const moduleId = chipId

      this.statusUpdateBuffer.push({ moduleId, chipId, type: 'sensors_config', data: metadata })
      return true
    } catch (e) {
      this.fastify.log.warn(`⚠️ Failed to parse config: ${e}`)
      return false
    }
  }

  /**
   * Handle hardware config messages: mesurable/{chipId}/hardware
   */
  private handleHardwareMessage(payload: string, parsed: TopicParts): boolean {
    try {
      const metadata = JSON.parse(payload)
      const { chipId } = parsed
      const moduleId = chipId

      this.statusUpdateBuffer.push({ moduleId, chipId, type: 'hardware', data: metadata })
      return true
    } catch (e) {
      this.fastify.log.warn(`⚠️ Failed to parse hardware: ${e}`)
      return false
    }
  }

  /**
   * Handle device log messages: mesurable/{chipId}/log
   */
  private handleLogMessage(payload: string, parsed: TopicParts): boolean {
    try {
      const logEntry = JSON.parse(payload)
      const { level, msg, time } = logEntry
      const { chipId } = parsed

      const logData = {
        msg: `[HARDWARE:${chipId}] ${msg}`,
        direction: 'IN',
        moduleId: chipId,
        deviceTime: time,
        source: 'SYSTEM',
        category: 'HARDWARE',
      }

      const logLevel = (level || 'info').toLowerCase()
      switch (logLevel) {
        case 'trace': this.fastify.log.trace(logData); break
        case 'debug': this.fastify.log.debug(logData); break
        case 'warn': this.fastify.log.warn(logData); break
        case 'success': this.fastify.log.success(logData); break
        case 'error': this.fastify.log.error(logData); break
        case 'fatal': this.fastify.log.fatal(logData); break
        case 'info':
        default: this.fastify.log.info(logData); break
      }
      return true
    } catch (e) {
      this.fastify.log.warn(`⚠️ Failed to parse device log: ${e}`)
      return false
    }
  }

  /**
   * Handle online/offline messages (LWT): mesurable/{chipId}/online
   * 
   * Published by ESP on connect: {"online":true}
   * Published by broker (LWT) on unexpected disconnect: {"online":false}
   */
  private handleOnlineMessage(payload: string, parsed: TopicParts): boolean {
    try {
      const data = JSON.parse(payload)
      const { chipId } = parsed
      const isOnline = data.online === true

      this.fastify.log.info({
        msg: `[MQTT] ${isOnline ? '🟢' : '🔴'} Device ${chipId} is ${isOnline ? 'ONLINE' : 'OFFLINE'}`,
        category: 'MQTT',
        source: 'LWT',
        chipId,
        online: isOnline,
      })

      // Push status update to buffer
      this.statusUpdateBuffer.push({
        moduleId: chipId,
        chipId,
        type: 'system_config',
        data: { online: isOnline, chipId }
      })

      if (this.statusUpdateBuffer.length >= 50) {
        void this.onStatusBufferFull()
      }

      return true
    } catch (e) {
      this.fastify.log.warn(`⚠️ Failed to parse online message from ${parsed.chipId}: ${e}`)
      return false
    }
  }

  /**
   * Validate sensor value to reject aberrant readings.
   */
  private isValueValid(chipId: string, sensorType: string, value: number): boolean {
    const range = registry.getValidationRange(sensorType)
    if (!range) return true

    if (value < range.min || value > range.max) {
      this.fastify.log.warn({
        msg: `[MQTT] ⚠️ Aberrant value rejected: ${sensorType}=${value} (valid range: ${range.min}-${range.max})`,
        category: 'MQTT',
        source: 'SYSTEM',
        chipId,
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
   * Handle sensor measurement messages: mesurable/{chipId}/data/{hardwareId}/{sensorType}
   */
  private handleDataMessage(payload: string, parsed: TopicParts, now: Date): boolean {
    if (parsed.rest.length !== 2) {
      return false
    }

    const { chipId } = parsed
    const hardwareId = parsed.rest[0]
    const sensorType = parsed.rest[1]

    const value = parseFloat(payload)
    if (isNaN(value)) {
      this.fastify.log.warn(`[MQTT] Rejected NaN value: mesurable/${chipId}/data/${hardwareId}/${sensorType}`)
      return false
    }

    // Validate value range
    if (!this.isValueValid(chipId, sensorType, value)) {
      return true // Message was handled (rejected)
    }

    this.measurementBuffer.push({
      time: now,
      moduleId: chipId,  // chipId IS the moduleId in the new namespace
      chipId,
      sensorType,
      hardwareId,
      value
    })

    if (this.measurementBuffer.length >= 100) {
      void this.onMeasurementBufferFull()
    }
    return true
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

    if (!parsed) return null

    // JSON messages (metadata)
    if (['announce', 'status', 'config', 'system', 'hardware'].includes(parsed.subtopic)) {
      try {
        const data = JSON.parse(payload) as Record<string, unknown>
        // Handle nested sensors/status format
        if (parsed.subtopic === 'status' && data.sensors && typeof data.sensors === 'object') {
          wsMetadata = data.sensors as Record<string, unknown>
        } else {
          wsMetadata = data
        }
      } catch {
        // Ignore parse errors
      }
    }
    // Numeric sensor measurements: mesurable/{chipId}/data/{hw}/{sensor}
    else if (parsed.subtopic === 'data' && parsed.rest.length === 2) {
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
    const parsed = parseTopic(topic)

    if (!parsed) {
      return  // Not in mesurable/ namespace, ignore
    }

    const { chipId } = parsed

    // Try handlers in order based on subtopic
    switch (parsed.subtopic) {
      case 'announce':
        this.handleAnnounceMessage(payload, chipId)
        break
      case 'system':
        this.handleSystemMessage(payload, parsed)
        break
      case 'status':
        this.handleStatusMessage(payload, parsed)
        break
      case 'config':
        this.handleConfigMessage(payload, parsed)
        break
      case 'hardware':
        this.handleHardwareMessage(payload, parsed)
        break
      case 'log':
        this.handleLogMessage(payload, parsed)
        break
      case 'online':
        this.handleOnlineMessage(payload, parsed)
        break
      case 'data':
        if (!this.handleDataMessage(payload, parsed, now)) {
          this.fastify.log.info(`⚠️ Data topic not processed: ${topic}`)
        }
        break
      default:
        this.fastify.log.info(`⚠️ Topic not processed: ${topic}`)
    }

    // Broadcast via WebSocket
    const wsData = this.prepareWebSocketData(topic, payload, parsed, now)
    if (wsData && this.fastify.io) {
      const clientCount = this.fastify.io.sockets.sockets.size
      if (clientCount > 0) {
        this.fastify.io.emit('mqtt:data', wsData)
      }
    }
  }
}
