/**
 * MQTT Service - Pure business logic extracted from MqttMessageHandler
 *
 * This module contains testable pure functions for MQTT message processing.
 * No dependencies on Fastify or other infrastructure.
 */

// ============================================================================
// Types
// ============================================================================

export interface TopicParts {
    moduleId: string
    category: string | null
    sensorType: string | null
    parts: string[]
}

export interface ValidationRange {
    min: number
    max: number
}

export interface ParsedMeasurement {
    moduleId: string
    sensorType: string
    hardwareId: string
    value: number
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Canonical sensor key mappings - all hardware uses the same canonical keys.
 * The hardware_id is stored separately to track the source.
 */
export const CANONICAL_MAPPINGS: Record<string, Record<string, string>> = {
    bmp280: {
        temperature: 'temperature',
        pressure: 'pressure',
    },
    sht40: {
        temperature: 'temperature',
        humidity: 'humidity',
    },
    sht31: {
        temperature: 'temperature',
        humidity: 'humidity',
    },
    dht22: {
        temperature: 'temperature',
        humidity: 'humidity',
    },
    sgp30: {
        eco2: 'eco2',
        tvoc: 'tvoc',
    },
    sgp40: {
        voc: 'voc',
    },
    sps30: {
        pm1: 'pm1',
        pm25: 'pm25',
        pm4: 'pm4',
        pm10: 'pm10',
    },
    mhz14a: {
        co2: 'co2',
    },
    mq7: {
        co: 'co',
    },
} as const

/**
 * Module IDs to skip (test patterns)
 */
const SKIP_MODULE_PREFIXES = ['home', 'dev'] as const
const SKIP_MODULE_IDS = ['test-module'] as const

// ============================================================================
// Pure Functions
// ============================================================================

/**
 * Parse MQTT topic structure: module_id/category/sensor_type
 *
 * @param topic - The MQTT topic string
 * @returns Parsed topic parts or null if topic should be skipped
 *
 * @example
 * parseTopic('croissance/dht22/temperature')
 * // => { moduleId: 'croissance', category: 'dht22', sensorType: 'temperature', parts: [...] }
 *
 * parseTopic('test-module/something')
 * // => null (skipped)
 */
export function parseTopic(topic: string): TopicParts | null {
    const parts = topic.split('/')

    if (parts.length < 2) {
        return null
    }

    const moduleId = parts[0]

    // Skip test topics
    for (const prefix of SKIP_MODULE_PREFIXES) {
        if (moduleId.startsWith(prefix)) {
            return null
        }
    }

    if ((SKIP_MODULE_IDS as readonly string[]).includes(moduleId)) {
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
 * Check if topic matches a specific category pattern
 *
 * @param topic - The MQTT topic
 * @param suffix - The expected suffix (e.g., '/system', '/sensors/status')
 */
export function matchesTopic(topic: string, suffix: string): boolean {
    return topic.endsWith(suffix)
}

/**
 * Validate sensor value against known range
 *
 * @param sensorType - Canonical sensor type (e.g., 'temperature', 'humidity')
 * @param value - The sensor reading value
 * @param getRange - Function to retrieve validation range (injected dependency)
 * @returns true if value is valid, false if out of range
 */
export function isValueValid(
    sensorType: string,
    value: number,
    getRange: (type: string) => ValidationRange | undefined
): { valid: boolean; range?: ValidationRange; reason?: string } {
    const range = getRange(sensorType)

    // Unknown sensor type - allow (backwards compatibility)
    if (!range) {
        return { valid: true }
    }

    if (value < range.min || value > range.max) {
        return {
            valid: false,
            range,
            reason: `Value ${value} out of range [${range.min}, ${range.max}]`,
        }
    }

    return { valid: true, range }
}

/**
 * Map hardware-specific sensor type to canonical type
 *
 * @param hardwareId - The hardware identifier (e.g., 'dht22', 'bmp280')
 * @param measurementType - The measurement type from topic
 * @returns Canonical sensor type
 *
 * @example
 * getCanonicalSensorType('sht40', 'temperature') // => 'temperature'
 * getCanonicalSensorType('unknown', 'custom')    // => 'custom' (passthrough)
 */
export function getCanonicalSensorType(hardwareId: string, measurementType: string): string {
    const hardwareMap = CANONICAL_MAPPINGS[hardwareId]
    return hardwareMap?.[measurementType] ?? measurementType
}

/**
 * Check if a topic represents a measurement message (hardware-aware format)
 *
 * Format: module_id/hardware_id/measurement
 * Examples: croissance/dht22/temperature, croissance/bmp280/pressure
 *
 * @param parsed - Parsed topic parts
 * @param topic - Original topic string
 * @returns true if this is a measurement topic
 */
export function isMeasurementTopic(parsed: TopicParts, topic: string): boolean {
    const { category, parts } = parsed

    return (
        parts.length === 3 &&
        category !== 'sensors' &&
        !topic.includes('/status') &&
        !topic.includes('/config')
    )
}

/**
 * Parse a measurement from topic and payload
 *
 * @param parsed - Parsed topic parts
 * @param payload - Raw payload string
 * @returns Parsed measurement or null if invalid
 */
export function parseMeasurement(
    parsed: TopicParts,
    payload: string
): ParsedMeasurement | null {
    const { moduleId, parts } = parsed

    if (parts.length !== 3) {
        return null
    }

    const hardwareId = parts[1]
    const measurementType = parts[2]
    const canonicalSensorType = getCanonicalSensorType(hardwareId, measurementType)

    const value = parseFloat(payload)
    if (isNaN(value)) {
        return null
    }

    return {
        moduleId,
        sensorType: canonicalSensorType,
        hardwareId,
        value,
    }
}

/**
 * Safely parse JSON payload
 *
 * @param payload - Raw JSON string
 * @returns Parsed object or null if invalid
 */
export function safeParseJson<T = Record<string, unknown>>(payload: string): T | null {
    try {
        return JSON.parse(payload) as T
    } catch {
        return null
    }
}

/**
 * Identify message category from topic
 */
export type MessageCategory =
    | 'system'
    | 'system_config'
    | 'sensors_status'
    | 'sensors_config'
    | 'hardware_config'
    | 'logs'
    | 'measurement'
    | 'unknown'

export function identifyMessageCategory(topic: string, parsed: TopicParts): MessageCategory {
    if (topic.endsWith('/system/config')) return 'system_config'
    if (topic.endsWith('/system')) return 'system'
    if (topic.endsWith('/sensors/status')) return 'sensors_status'
    if (topic.endsWith('/sensors/config')) return 'sensors_config'
    if (topic.endsWith('/hardware/config')) return 'hardware_config'
    if (topic.endsWith('/logs')) return 'logs'
    if (isMeasurementTopic(parsed, topic)) return 'measurement'
    return 'unknown'
}
