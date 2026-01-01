/**
 * Unit tests for Device Service
 */
import { describe, it, expect } from 'vitest'
import {
    buildSystemInfo,
    buildHardwareInfo,
    buildSensorsStatus,
    buildSensorsConfig,
    buildDeviceStatus,
    buildSensorKey,
    buildSensorHistory,
    calculateBucketSize,
    type DeviceStatusRow,
    type SensorStatusRowInput,
    type SensorConfigRowInput,
    type HistoryRowInput,
} from '../service'

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockStatusRow = (overrides: Partial<DeviceStatusRow> = {}): DeviceStatusRow => ({
    moduleId: 'test-module',
    ip: '192.168.1.100',
    mac: 'AA:BB:CC:DD:EE:FF',
    bootedAt: new Date('2024-01-15T10:30:00Z'),
    rssi: -45,
    flashUsedKb: 1024,
    flashFreeKb: 2048,
    flashSystemKb: 512,
    heapTotalKb: 320,
    heapFreeKb: 128,
    heapMinFreeKb: 64,
    chipModel: 'ESP32-D0WDQ6',
    chipRev: 3,
    cpuFreqMhz: 240,
    flashKb: 4096,
    cores: 2,
    preferences: { displayName: 'Living Room' },
    zoneName: 'Maison',
    moduleType: 'air-quality',
    ...overrides,
})

// ============================================================================
// buildSystemInfo Tests
// ============================================================================

describe('buildSystemInfo', () => {
    it('should transform all system fields', () => {
        const row = createMockStatusRow()
        const result = buildSystemInfo(row)

        expect(result).toEqual({
            ip: '192.168.1.100',
            mac: 'AA:BB:CC:DD:EE:FF',
            bootedAt: '2024-01-15T10:30:00.000Z',
            rssi: -45,
            flash: {
                usedKb: 1024,
                freeKb: 2048,
                systemKb: 512,
            },
            memory: {
                heapTotalKb: 320,
                heapFreeKb: 128,
                heapMinFreeKb: 64,
            },
        })
    })

    it('should handle null bootedAt', () => {
        const row = createMockStatusRow({ bootedAt: null })
        const result = buildSystemInfo(row)

        expect(result.bootedAt).toBeNull()
    })

    it('should handle null optional fields', () => {
        const row = createMockStatusRow({
            ip: null,
            mac: null,
            rssi: null,
        })
        const result = buildSystemInfo(row)

        expect(result.ip).toBeNull()
        expect(result.mac).toBeNull()
        expect(result.rssi).toBeNull()
    })
})

// ============================================================================
// buildHardwareInfo Tests
// ============================================================================

describe('buildHardwareInfo', () => {
    it('should transform hardware fields when chipModel exists', () => {
        const row = createMockStatusRow()
        const result = buildHardwareInfo(row)

        expect(result).toEqual({
            chip: {
                model: 'ESP32-D0WDQ6',
                rev: 3,
                cpuFreqMhz: 240,
                flashKb: 4096,
                cores: 2,
            },
        })
    })

    it('should return null when chipModel is missing', () => {
        const row = createMockStatusRow({ chipModel: null })
        const result = buildHardwareInfo(row)

        expect(result).toBeNull()
    })

    it('should handle partial hardware info', () => {
        const row = createMockStatusRow({
            chipModel: 'ESP8266',
            chipRev: undefined,
            cpuFreqMhz: undefined,
            flashKb: undefined,
            cores: undefined,
        })
        const result = buildHardwareInfo(row)

        expect(result?.chip.model).toBe('ESP8266')
        expect(result?.chip.rev).toBeNull()
        expect(result?.chip.cores).toBeNull()
    })
})

// ============================================================================
// buildSensorsStatus Tests
// ============================================================================

describe('buildSensorsStatus', () => {
    it('should transform sensor status rows', () => {
        const rows: SensorStatusRowInput[] = [
            { sensorType: 'temperature', status: 'ok', value: 22.5 },
            { sensorType: 'humidity', status: 'ok', value: 45.0 },
        ]

        const result = buildSensorsStatus(rows)

        expect(result).toEqual({
            temperature: { status: 'ok', value: 22.5 },
            humidity: { status: 'ok', value: 45.0 },
        })
    })

    it('should default null status to unknown', () => {
        const rows: SensorStatusRowInput[] = [
            { sensorType: 'co2', status: null, value: 400 },
        ]

        const result = buildSensorsStatus(rows)

        expect(result.co2.status).toBe('unknown')
    })

    it('should handle empty array', () => {
        const result = buildSensorsStatus([])
        expect(result).toEqual({})
    })
})

// ============================================================================
// buildSensorsConfig Tests
// ============================================================================

describe('buildSensorsConfig', () => {
    it('should transform sensor config rows', () => {
        const rows: SensorConfigRowInput[] = [
            { sensorType: 'dht22:temperature', intervalSeconds: 30, model: 'DHT22' },
            { sensorType: 'bmp280:pressure', intervalSeconds: 60, model: 'BMP280' },
        ]

        const result = buildSensorsConfig(rows)

        expect(result).toEqual({
            sensors: {
                'dht22:temperature': { interval: 30, model: 'DHT22' },
                'bmp280:pressure': { interval: 60, model: 'BMP280' },
            },
        })
    })

    it('should handle null values', () => {
        const rows: SensorConfigRowInput[] = [
            { sensorType: 'unknown', intervalSeconds: null, model: null },
        ]

        const result = buildSensorsConfig(rows)

        expect(result.sensors.unknown.interval).toBeNull()
        expect(result.sensors.unknown.model).toBeNull()
    })
})

// ============================================================================
// buildDeviceStatus Tests
// ============================================================================

describe('buildDeviceStatus', () => {
    it('should build complete status with all data', () => {
        const statusRow = createMockStatusRow()
        const sensorStatusRows: SensorStatusRowInput[] = [
            { sensorType: 'temperature', status: 'ok', value: 22.5 },
        ]
        const sensorConfigRows: SensorConfigRowInput[] = [
            { sensorType: 'dht22:temperature', intervalSeconds: 30, model: 'DHT22' },
        ]

        const result = buildDeviceStatus(statusRow, sensorStatusRows, sensorConfigRows)

        expect(result.system).toBeDefined()
        expect(result.hardware).toBeDefined()
        expect(result.sensors).toEqual({ temperature: { status: 'ok', value: 22.5 } })
        expect(result.sensorsConfig?.sensors).toHaveProperty('dht22:temperature')
        expect(result.zoneName).toBe('Maison')
        expect(result.moduleType).toBe('air-quality')
        expect(result.preferences).toEqual({ displayName: 'Living Room' })
    })

    it('should handle null statusRow', () => {
        const result = buildDeviceStatus(null, [], [])

        expect(result.system).toBeUndefined()
        expect(result.hardware).toBeUndefined()
        expect(result.sensors).toEqual({})
        expect(result.sensorsConfig).toEqual({ sensors: {} })
    })

    it('should omit zoneName and moduleType when null', () => {
        const statusRow = createMockStatusRow({ zoneName: null, moduleType: null })
        const result = buildDeviceStatus(statusRow, [], [])

        expect(result.zoneName).toBeUndefined()
        expect(result.moduleType).toBeUndefined()
    })
})

// ============================================================================
// buildSensorKey Tests
// ============================================================================

describe('buildSensorKey', () => {
    it('should build composite key with hardware', () => {
        expect(buildSensorKey('dht22', 'temperature')).toBe('dht22:temperature')
        expect(buildSensorKey('BMP280', 'PRESSURE')).toBe('bmp280:pressure')
    })

    it('should return sensor type only for unknown hardware', () => {
        expect(buildSensorKey('unknown', 'temperature')).toBe('temperature')
        expect(buildSensorKey(null, 'humidity')).toBe('humidity')
    })

    it('should normalize to lowercase', () => {
        expect(buildSensorKey('DHT22', 'Temperature')).toBe('dht22:temperature')
    })
})

// ============================================================================
// buildSensorHistory Tests
// ============================================================================

describe('buildSensorHistory', () => {
    it('should group history by sensor key', () => {
        const time1 = new Date('2024-01-15T10:00:00Z')
        const time2 = new Date('2024-01-15T10:01:00Z')

        const rows: HistoryRowInput[] = [
            { time: time1, sensorType: 'temperature', hardwareId: 'dht22', value: 22.5 },
            { time: time2, sensorType: 'temperature', hardwareId: 'dht22', value: 23.0 },
            { time: time1, sensorType: 'humidity', hardwareId: 'dht22', value: 45.0 },
        ]

        const result = buildSensorHistory(rows)

        expect(Object.keys(result)).toEqual(['dht22:temperature', 'dht22:humidity'])
        expect(result['dht22:temperature']).toHaveLength(2)
        expect(result['dht22:humidity']).toHaveLength(1)
    })

    it('should handle empty array', () => {
        const result = buildSensorHistory([])
        expect(result).toEqual({})
    })

    it('should handle rows without hardware', () => {
        const rows: HistoryRowInput[] = [
            { time: new Date(), sensorType: 'co2', hardwareId: null, value: 400 },
        ]

        const result = buildSensorHistory(rows)

        expect(result).toHaveProperty('co2')
    })
})

// ============================================================================
// calculateBucketSize Tests
// ============================================================================

describe('calculateBucketSize', () => {
    describe('explicit bucket sizes', () => {
        it('should return null for raw', () => {
            expect(calculateBucketSize(7, 'raw')).toBeNull()
        })

        it('should parse 1m bucket', () => {
            expect(calculateBucketSize(7, '1m')).toBe(60)
        })

        it('should parse 5m bucket', () => {
            expect(calculateBucketSize(7, '5m')).toBe(300)
        })

        it('should parse 15m bucket', () => {
            expect(calculateBucketSize(7, '15m')).toBe(900)
        })

        it('should parse 1h bucket', () => {
            expect(calculateBucketSize(7, '1h')).toBe(3600)
        })

        it('should return null for unknown bucket', () => {
            expect(calculateBucketSize(7, 'invalid')).toBeNull()
        })
    })

    describe('auto bucket selection', () => {
        it('should return null (raw) for 1 day or less', () => {
            expect(calculateBucketSize(1, 'auto')).toBeNull()
            expect(calculateBucketSize(0.5, 'auto')).toBeNull()
        })

        it('should return 5 minutes for 2-7 days', () => {
            expect(calculateBucketSize(2, 'auto')).toBe(300)
            expect(calculateBucketSize(7, 'auto')).toBe(300)
        })

        it('should return 15 minutes for 8-30 days', () => {
            expect(calculateBucketSize(8, 'auto')).toBe(900)
            expect(calculateBucketSize(30, 'auto')).toBe(900)
        })

        it('should return 1 hour for more than 30 days', () => {
            expect(calculateBucketSize(31, 'auto')).toBe(3600)
            expect(calculateBucketSize(365, 'auto')).toBe(3600)
        })
    })
})
