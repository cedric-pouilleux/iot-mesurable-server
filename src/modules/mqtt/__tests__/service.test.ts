/**
 * Unit tests for MQTT Service
 */
import { describe, it, expect } from 'vitest'
import {
    parseTopic,
    matchesTopic,
    isValueValid,
    getCanonicalSensorType,
    isMeasurementTopic,
    parseMeasurement,
    safeParseJson,
    identifyMessageCategory,
    CANONICAL_MAPPINGS,
    type TopicParts,
    type ValidationRange,
} from '../service'

// ============================================================================
// parseTopic Tests
// ============================================================================

describe('parseTopic', () => {
    describe('valid topics', () => {
        it('should parse a simple two-part topic', () => {
            const result = parseTopic('croissance/system')

            expect(result).toEqual({
                moduleId: 'croissance',
                category: 'system',
                sensorType: null,
                parts: ['croissance', 'system'],
            })
        })

        it('should parse a three-part measurement topic', () => {
            const result = parseTopic('croissance/dht22/temperature')

            expect(result).toEqual({
                moduleId: 'croissance',
                category: 'dht22',
                sensorType: 'temperature',
                parts: ['croissance', 'dht22', 'temperature'],
            })
        })

        it('should parse topics with many parts', () => {
            const result = parseTopic('module/sensors/status/extra')

            expect(result).toEqual({
                moduleId: 'module',
                category: 'sensors',
                sensorType: 'status',
                parts: ['module', 'sensors', 'status', 'extra'],
            })
        })
    })

    describe('skipped topics', () => {
        it('should return null for too short topics (only one part)', () => {
            expect(parseTopic('single')).toBeNull()
        })

        it('should return null for empty string', () => {
            expect(parseTopic('')).toBeNull()
        })

        it('should skip topics starting with home/', () => {
            expect(parseTopic('home/something/else')).toBeNull()
        })

        it('should skip topics starting with dev/', () => {
            expect(parseTopic('dev/test/value')).toBeNull()
        })

        it('should skip test-module topics', () => {
            expect(parseTopic('test-module/anything')).toBeNull()
        })
    })
})

// ============================================================================
// matchesTopic Tests
// ============================================================================

describe('matchesTopic', () => {
    it('should match topic with suffix', () => {
        expect(matchesTopic('croissance/system', '/system')).toBe(true)
        expect(matchesTopic('croissance/sensors/status', '/sensors/status')).toBe(true)
    })

    it('should not match topic without suffix', () => {
        expect(matchesTopic('croissance/system', '/config')).toBe(false)
        expect(matchesTopic('something/else', '/sensors/status')).toBe(false)
    })
})

// ============================================================================
// isValueValid Tests
// ============================================================================

describe('isValueValid', () => {
    const mockRanges: Record<string, ValidationRange> = {
        temperature: { min: -40, max: 85 },
        humidity: { min: 0, max: 100 },
        pressure: { min: 300, max: 1100 },
        co2: { min: 0, max: 5000 },
    }

    const getRange = (type: string): ValidationRange | undefined => mockRanges[type]

    describe('valid values', () => {
        it('should accept temperature within range', () => {
            const result = isValueValid('temperature', 22.5, getRange)
            expect(result.valid).toBe(true)
            expect(result.range).toEqual({ min: -40, max: 85 })
        })

        it('should accept value at min boundary', () => {
            const result = isValueValid('humidity', 0, getRange)
            expect(result.valid).toBe(true)
        })

        it('should accept value at max boundary', () => {
            const result = isValueValid('humidity', 100, getRange)
            expect(result.valid).toBe(true)
        })

        it('should accept unknown sensor types (backwards compatibility)', () => {
            const result = isValueValid('unknown_sensor', 999999, getRange)
            expect(result.valid).toBe(true)
            expect(result.range).toBeUndefined()
        })
    })

    describe('invalid values', () => {
        it('should reject temperature below range', () => {
            const result = isValueValid('temperature', -50, getRange)
            expect(result.valid).toBe(false)
            expect(result.reason).toContain('-50')
            expect(result.reason).toContain('-40')
        })

        it('should reject temperature above range', () => {
            const result = isValueValid('temperature', 100, getRange)
            expect(result.valid).toBe(false)
            expect(result.reason).toContain('85')
        })

        it('should reject humidity above 100', () => {
            const result = isValueValid('humidity', 150, getRange)
            expect(result.valid).toBe(false)
        })

        it('should reject negative humidity', () => {
            const result = isValueValid('humidity', -5, getRange)
            expect(result.valid).toBe(false)
        })
    })
})

// ============================================================================
// getCanonicalSensorType Tests
// ============================================================================

describe('getCanonicalSensorType', () => {
    it('should map known hardware sensors to canonical types', () => {
        expect(getCanonicalSensorType('dht22', 'temperature')).toBe('temperature')
        expect(getCanonicalSensorType('dht22', 'humidity')).toBe('humidity')
        expect(getCanonicalSensorType('bmp280', 'pressure')).toBe('pressure')
        expect(getCanonicalSensorType('sht40', 'temperature')).toBe('temperature')
        expect(getCanonicalSensorType('sht31', 'temperature')).toBe('temperature')
        expect(getCanonicalSensorType('sht31', 'humidity')).toBe('humidity')
        expect(getCanonicalSensorType('sgp30', 'tvoc')).toBe('tvoc')
        expect(getCanonicalSensorType('sgp40', 'voc')).toBe('voc')
    })

    it('should passthrough unknown hardware', () => {
        expect(getCanonicalSensorType('unknown_hw', 'custom_reading')).toBe('custom_reading')
    })

    it('should passthrough unknown measurement on known hardware', () => {
        expect(getCanonicalSensorType('dht22', 'unknown')).toBe('unknown')
    })

    it('should have all expected hardware in CANONICAL_MAPPINGS', () => {
        const expectedHardware = ['bmp280', 'sht40', 'sht31', 'dht22', 'sgp30', 'sgp40', 'sps30', 'mhz14a', 'mq7']
        for (const hw of expectedHardware) {
            expect(CANONICAL_MAPPINGS).toHaveProperty(hw)
        }
    })
})

// ============================================================================
// isMeasurementTopic Tests
// ============================================================================

describe('isMeasurementTopic', () => {
    it('should identify measurement topics', () => {
        const parsed: TopicParts = {
            moduleId: 'croissance',
            category: 'dht22',
            sensorType: 'temperature',
            parts: ['croissance', 'dht22', 'temperature'],
        }

        expect(isMeasurementTopic(parsed, 'croissance/dht22/temperature')).toBe(true)
    })

    it('should reject sensors category', () => {
        const parsed: TopicParts = {
            moduleId: 'croissance',
            category: 'sensors',
            sensorType: 'status',
            parts: ['croissance', 'sensors', 'status'],
        }

        expect(isMeasurementTopic(parsed, 'croissance/sensors/status')).toBe(false)
    })

    it('should reject status topics', () => {
        const parsed: TopicParts = {
            moduleId: 'croissance',
            category: 'something',
            sensorType: 'status',
            parts: ['croissance', 'something', 'status'],
        }

        expect(isMeasurementTopic(parsed, 'croissance/something/status')).toBe(false)
    })

    it('should reject config topics', () => {
        const parsed: TopicParts = {
            moduleId: 'croissance',
            category: 'hardware',
            sensorType: 'config',
            parts: ['croissance', 'hardware', 'config'],
        }

        expect(isMeasurementTopic(parsed, 'croissance/hardware/config')).toBe(false)
    })

    it('should reject two-part topics', () => {
        const parsed: TopicParts = {
            moduleId: 'croissance',
            category: 'system',
            sensorType: null,
            parts: ['croissance', 'system'],
        }

        expect(isMeasurementTopic(parsed, 'croissance/system')).toBe(false)
    })
})

// ============================================================================
// parseMeasurement Tests
// ============================================================================

describe('parseMeasurement', () => {
    it('should parse valid measurement', () => {
        const parsed: TopicParts = {
            moduleId: 'croissance',
            category: 'dht22',
            sensorType: 'temperature',
            parts: ['croissance', 'dht22', 'temperature'],
        }

        const result = parseMeasurement(parsed, '22.5')

        expect(result).toEqual({
            moduleId: 'croissance',
            sensorType: 'temperature',
            hardwareId: 'dht22',
            value: 22.5,
        })
    })

    it('should parse negative values', () => {
        const parsed: TopicParts = {
            moduleId: 'outside',
            category: 'dht22',
            sensorType: 'temperature',
            parts: ['outside', 'dht22', 'temperature'],
        }

        const result = parseMeasurement(parsed, '-10.5')

        expect(result).toEqual({
            moduleId: 'outside',
            sensorType: 'temperature',
            hardwareId: 'dht22',
            value: -10.5,
        })
    })

    it('should return null for non-numeric payload', () => {
        const parsed: TopicParts = {
            moduleId: 'croissance',
            category: 'dht22',
            sensorType: 'temperature',
            parts: ['croissance', 'dht22', 'temperature'],
        }

        expect(parseMeasurement(parsed, 'invalid')).toBeNull()
        expect(parseMeasurement(parsed, '')).toBeNull()
        expect(parseMeasurement(parsed, 'NaN')).toBeNull()
    })

    it('should return null for wrong number of parts', () => {
        const parsed: TopicParts = {
            moduleId: 'croissance',
            category: 'system',
            sensorType: null,
            parts: ['croissance', 'system'],
        }

        expect(parseMeasurement(parsed, '22.5')).toBeNull()
    })

    it('should map hardware sensor to canonical type', () => {
        const parsed: TopicParts = {
            moduleId: 'room',
            category: 'bmp280',
            sensorType: 'pressure',
            parts: ['room', 'bmp280', 'pressure'],
        }

        const result = parseMeasurement(parsed, '1013.25')

        expect(result?.sensorType).toBe('pressure')
    })
})

// ============================================================================
// safeParseJson Tests
// ============================================================================

describe('safeParseJson', () => {
    it('should parse valid JSON', () => {
        const result = safeParseJson('{"key": "value", "num": 42}')
        expect(result).toEqual({ key: 'value', num: 42 })
    })

    it('should return null for invalid JSON', () => {
        expect(safeParseJson('not json')).toBeNull()
        expect(safeParseJson('{invalid}')).toBeNull()
        expect(safeParseJson('')).toBeNull()
    })

    it('should handle arrays', () => {
        const result = safeParseJson('[1, 2, 3]')
        expect(result).toEqual([1, 2, 3])
    })
})

// ============================================================================
// identifyMessageCategory Tests
// ============================================================================

describe('identifyMessageCategory', () => {
    const makeParsed = (parts: string[]): TopicParts => ({
        moduleId: parts[0],
        category: parts[1] ?? null,
        sensorType: parts[2] ?? null,
        parts,
    })

    it('should identify system messages', () => {
        expect(identifyMessageCategory('croissance/system', makeParsed(['croissance', 'system']))).toBe(
            'system'
        )
    })

    it('should identify system/config messages', () => {
        expect(
            identifyMessageCategory('croissance/system/config', makeParsed(['croissance', 'system', 'config']))
        ).toBe('system_config')
    })

    it('should identify sensors/status messages', () => {
        expect(
            identifyMessageCategory('croissance/sensors/status', makeParsed(['croissance', 'sensors', 'status']))
        ).toBe('sensors_status')
    })

    it('should identify sensors/config messages', () => {
        expect(
            identifyMessageCategory('croissance/sensors/config', makeParsed(['croissance', 'sensors', 'config']))
        ).toBe('sensors_config')
    })

    it('should identify hardware/config messages', () => {
        expect(
            identifyMessageCategory(
                'croissance/hardware/config',
                makeParsed(['croissance', 'hardware', 'config'])
            )
        ).toBe('hardware_config')
    })

    it('should identify logs messages', () => {
        expect(
            identifyMessageCategory('croissance/logs', makeParsed(['croissance', 'logs']))
        ).toBe('logs')
    })

    it('should identify measurement messages', () => {
        const parsed = makeParsed(['croissance', 'dht22', 'temperature'])
        expect(identifyMessageCategory('croissance/dht22/temperature', parsed)).toBe('measurement')
    })

    it('should return unknown for unrecognized topics', () => {
        const parsed = makeParsed(['croissance', 'unknown'])
        expect(identifyMessageCategory('croissance/unknown', parsed)).toBe('unknown')
    })
})
