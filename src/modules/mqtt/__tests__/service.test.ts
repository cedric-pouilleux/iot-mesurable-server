/**
 * Unit tests for MQTT Service (mesurable/{chipId}/... namespace)
 */
import { describe, it, expect } from 'vitest'
import {
    parseTopic,
    matchesTopic,
    isValueValid,
    isMeasurementTopic,
    parseMeasurement,
    safeParseJson,
    identifyMessageCategory,
    type TopicParts,
    type ValidationRange,
} from '../service'

// ============================================================================
// parseTopic Tests
// ============================================================================

describe('parseTopic', () => {
    describe('valid topics', () => {
        it('should parse a data measurement topic', () => {
            const result = parseTopic('mesurable/ABCDEF123456/data/scd41/co2')

            expect(result).toEqual({
                chipId: 'ABCDEF123456',
                subtopic: 'data',
                rest: ['scd41', 'co2'],
                parts: ['mesurable', 'ABCDEF123456', 'data', 'scd41', 'co2'],
            })
        })

        it('should parse an announce topic', () => {
            const result = parseTopic('mesurable/ABCDEF123456/announce')

            expect(result).toEqual({
                chipId: 'ABCDEF123456',
                subtopic: 'announce',
                rest: [],
                parts: ['mesurable', 'ABCDEF123456', 'announce'],
            })
        })

        it('should parse a status topic', () => {
            const result = parseTopic('mesurable/ABCDEF123456/status')

            expect(result).toEqual({
                chipId: 'ABCDEF123456',
                subtopic: 'status',
                rest: [],
                parts: ['mesurable', 'ABCDEF123456', 'status'],
            })
        })

        it('should parse a system topic', () => {
            const result = parseTopic('mesurable/ABCDEF123456/system')

            expect(result).toEqual({
                chipId: 'ABCDEF123456',
                subtopic: 'system',
                rest: [],
                parts: ['mesurable', 'ABCDEF123456', 'system'],
            })
        })

        it('should parse a log topic', () => {
            const result = parseTopic('mesurable/ABCDEF123456/log')

            expect(result).toEqual({
                chipId: 'ABCDEF123456',
                subtopic: 'log',
                rest: [],
                parts: ['mesurable', 'ABCDEF123456', 'log'],
            })
        })
    })

    describe('skipped topics', () => {
        it('should return null for non-mesurable topics', () => {
            expect(parseTopic('home/something')).toBeNull()
            expect(parseTopic('air-quality/scd41/co2')).toBeNull()
        })

        it('should return null for too short mesurable topics', () => {
            expect(parseTopic('mesurable/chipId')).toBeNull()
            expect(parseTopic('mesurable')).toBeNull()
        })

        it('should return null for empty string', () => {
            expect(parseTopic('')).toBeNull()
        })
    })
})

// ============================================================================
// matchesTopic Tests
// ============================================================================

describe('matchesTopic', () => {
    it('should match topic with suffix', () => {
        expect(matchesTopic('mesurable/ABC/system', '/system')).toBe(true)
        expect(matchesTopic('mesurable/ABC/announce', '/announce')).toBe(true)
    })

    it('should not match topic without suffix', () => {
        expect(matchesTopic('mesurable/ABC/system', '/config')).toBe(false)
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
    })
})

// ============================================================================
// isMeasurementTopic Tests
// ============================================================================

describe('isMeasurementTopic', () => {
    it('should identify data measurement topics', () => {
        const parsed: TopicParts = {
            chipId: 'ABCDEF',
            subtopic: 'data',
            rest: ['scd41', 'co2'],
            parts: ['mesurable', 'ABCDEF', 'data', 'scd41', 'co2'],
        }
        expect(isMeasurementTopic(parsed)).toBe(true)
    })

    it('should reject data topics with wrong rest length', () => {
        const parsed: TopicParts = {
            chipId: 'ABCDEF',
            subtopic: 'data',
            rest: ['scd41'],
            parts: ['mesurable', 'ABCDEF', 'data', 'scd41'],
        }
        expect(isMeasurementTopic(parsed)).toBe(false)
    })

    it('should reject non-data subtopics', () => {
        const parsed: TopicParts = {
            chipId: 'ABCDEF',
            subtopic: 'status',
            rest: [],
            parts: ['mesurable', 'ABCDEF', 'status'],
        }
        expect(isMeasurementTopic(parsed)).toBe(false)
    })
})

// ============================================================================
// parseMeasurement Tests
// ============================================================================

describe('parseMeasurement', () => {
    it('should parse valid measurement', () => {
        const parsed: TopicParts = {
            chipId: 'ABCDEF',
            subtopic: 'data',
            rest: ['scd41', 'co2'],
            parts: ['mesurable', 'ABCDEF', 'data', 'scd41', 'co2'],
        }

        const result = parseMeasurement(parsed, '450')

        expect(result).toEqual({
            chipId: 'ABCDEF',
            sensorType: 'co2',
            hardwareId: 'scd41',
            value: 450,
        })
    })

    it('should parse negative values', () => {
        const parsed: TopicParts = {
            chipId: 'ABCDEF',
            subtopic: 'data',
            rest: ['scd41', 'temperature'],
            parts: ['mesurable', 'ABCDEF', 'data', 'scd41', 'temperature'],
        }

        const result = parseMeasurement(parsed, '-10.5')

        expect(result).toEqual({
            chipId: 'ABCDEF',
            sensorType: 'temperature',
            hardwareId: 'scd41',
            value: -10.5,
        })
    })

    it('should return null for non-numeric payload', () => {
        const parsed: TopicParts = {
            chipId: 'ABCDEF',
            subtopic: 'data',
            rest: ['scd41', 'co2'],
            parts: ['mesurable', 'ABCDEF', 'data', 'scd41', 'co2'],
        }

        expect(parseMeasurement(parsed, 'invalid')).toBeNull()
        expect(parseMeasurement(parsed, '')).toBeNull()
        expect(parseMeasurement(parsed, 'NaN')).toBeNull()
    })

    it('should return null for non-data topics', () => {
        const parsed: TopicParts = {
            chipId: 'ABCDEF',
            subtopic: 'status',
            rest: [],
            parts: ['mesurable', 'ABCDEF', 'status'],
        }

        expect(parseMeasurement(parsed, '22.5')).toBeNull()
    })

    it('should use sensorType directly from topic (no canonical mapping)', () => {
        const parsed: TopicParts = {
            chipId: 'ABCDEF',
            subtopic: 'data',
            rest: ['bmp280', 'pressure'],
            parts: ['mesurable', 'ABCDEF', 'data', 'bmp280', 'pressure'],
        }

        const result = parseMeasurement(parsed, '1013.25')

        expect(result?.sensorType).toBe('pressure')
        expect(result?.hardwareId).toBe('bmp280')
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
    const makeParsed = (chipId: string, subtopic: string, rest: string[] = []): TopicParts => ({
        chipId,
        subtopic,
        rest,
        parts: ['mesurable', chipId, subtopic, ...rest],
    })

    it('should identify announce messages', () => {
        expect(identifyMessageCategory(makeParsed('ABC', 'announce'))).toBe('announce')
    })

    it('should identify data messages', () => {
        expect(identifyMessageCategory(makeParsed('ABC', 'data', ['scd41', 'co2']))).toBe('data')
    })

    it('should identify status messages', () => {
        expect(identifyMessageCategory(makeParsed('ABC', 'status'))).toBe('status')
    })

    it('should identify config messages', () => {
        expect(identifyMessageCategory(makeParsed('ABC', 'config'))).toBe('config')
    })

    it('should identify system messages', () => {
        expect(identifyMessageCategory(makeParsed('ABC', 'system'))).toBe('system')
    })

    it('should identify hardware messages', () => {
        expect(identifyMessageCategory(makeParsed('ABC', 'hardware'))).toBe('hardware')
    })

    it('should identify log messages', () => {
        expect(identifyMessageCategory(makeParsed('ABC', 'log'))).toBe('log')
    })

    it('should return unknown for unrecognized subtopics', () => {
        expect(identifyMessageCategory(makeParsed('ABC', 'whatever'))).toBe('unknown')
    })

    it('should return unknown for data topics with wrong rest length', () => {
        expect(identifyMessageCategory(makeParsed('ABC', 'data', ['only_one']))).toBe('unknown')
    })
})
