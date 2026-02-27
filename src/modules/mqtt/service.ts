/**
 * MQTT Service - Pure business logic for MQTT message processing
 *
 * Topic namespace: mesurable/{chipId}/...
 * No dependencies on Fastify or other infrastructure.
 */

// ============================================================================
// Types
// ============================================================================

export interface TopicParts {
    chipId: string
    subtopic: string        // e.g., 'data', 'announce', 'status', 'system', 'log', 'config', etc.
    rest: string[]           // remaining parts after subtopic
    parts: string[]          // all parts
}

export interface ValidationRange {
    min: number
    max: number
}

export interface ParsedMeasurement {
    chipId: string
    sensorType: string
    hardwareId: string
    value: number
}

// ============================================================================
// Pure Functions
// ============================================================================

/**
 * Parse MQTT topic structure: mesurable/{chipId}/{subtopic}/...
 *
 * @param topic - The MQTT topic string
 * @returns Parsed topic parts or null if not in mesurable/ namespace
 *
 * @example
 * parseTopic('mesurable/ABCDEF123456/data/scd41/co2')
 * // => { chipId: 'ABCDEF123456', subtopic: 'data', rest: ['scd41', 'co2'], parts: [...] }
 *
 * parseTopic('mesurable/ABCDEF123456/announce')
 * // => { chipId: 'ABCDEF123456', subtopic: 'announce', rest: [], parts: [...] }
 *
 * parseTopic('home/something') // => null (not mesurable/)
 */
export function parseTopic(topic: string): TopicParts | null {
    const parts = topic.split('/')

    // Must start with 'mesurable' and have at least 3 parts: mesurable/{chipId}/{subtopic}
    if (parts.length < 3 || parts[0] !== 'mesurable') {
        return null
    }

    const chipId = parts[1]
    const subtopic = parts[2]
    const rest = parts.slice(3)

    return {
        chipId,
        subtopic,
        rest,
        parts,
    }
}

/**
 * Check if topic matches a specific category pattern
 */
export function matchesTopic(topic: string, suffix: string): boolean {
    return topic.endsWith(suffix)
}

/**
 * Validate sensor value against known range
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
 * Check if a topic represents a measurement message
 *
 * Format: mesurable/{chipId}/data/{hardwareId}/{sensorType}
 */
export function isMeasurementTopic(parsed: TopicParts): boolean {
    return parsed.subtopic === 'data' && parsed.rest.length === 2
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
    if (!isMeasurementTopic(parsed)) {
        return null
    }

    const hardwareId = parsed.rest[0]
    const sensorType = parsed.rest[1]

    const value = parseFloat(payload)
    if (isNaN(value)) {
        return null
    }

    return {
        chipId: parsed.chipId,
        sensorType,
        hardwareId,
        value,
    }
}

/**
 * Safely parse JSON payload
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
    | 'announce'
    | 'data'
    | 'status'
    | 'config'
    | 'system'
    | 'hardware'
    | 'log'
    | 'online'
    | 'unknown'

export function identifyMessageCategory(parsed: TopicParts): MessageCategory {
    switch (parsed.subtopic) {
        case 'announce': return 'announce'
        case 'data': return isMeasurementTopic(parsed) ? 'data' : 'unknown'
        case 'status': return 'status'
        case 'config': return 'config'
        case 'system': return 'system'
        case 'hardware': return 'hardware'
        case 'log': return 'log'
        case 'online': return 'online'
        default: return 'unknown'
    }
}
