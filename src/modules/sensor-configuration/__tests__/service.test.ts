import { describe, it, expect } from 'vitest'
import { calculateSensorStatus, groupSensorsByHardware } from '../service'

describe('sensor-configuration/service', () => {
    describe('calculateSensorStatus', () => {
        const NOW = new Date('2024-01-01T12:00:00Z').getTime()

        it('should return "unknown" when lastUpdate is null', () => {
            const result = calculateSensorStatus({
                lastUpdate: null,
                intervalSeconds: 60,
                now: NOW,
            })
            expect(result).toBe('unknown')
        })

        it('should return "ok" when data is recent', () => {
            const lastUpdate = new Date('2024-01-01T11:59:00Z') // 60s ago
            const result = calculateSensorStatus({
                lastUpdate,
                intervalSeconds: 60,
                now: NOW,
            })
            expect(result).toBe('ok')
        })

        it('should return "missing" when timeout exceeded', () => {
            const lastUpdate = new Date('2024-01-01T10:00:00Z') // 2 hours ago
            const result = calculateSensorStatus({
                lastUpdate,
                intervalSeconds: 60,
                now: NOW,
            })
            expect(result).toBe('missing')
        })

        it('should handle 90s interval with grace period', () => {
            // 90s interval → timeout = 180s + 10s = 190s
            const lastUpdate = new Date('2024-01-01T11:57:00Z') // 180s ago
            const result = calculateSensorStatus({
                lastUpdate,
                intervalSeconds: 90,
                now: NOW,
            })
            expect(result).toBe('ok') // Within grace period
        })

        it('should use default interval when zero', () => {
            const lastUpdate = new Date('2024-01-01T11:59:00Z')
            const result = calculateSensorStatus({
                lastUpdate,
                intervalSeconds: 0,
                now: NOW,
            })
            expect(result).toBe('ok') // Uses default 60s
        })
    })

    describe('groupSensorsByHardware', () => {
        it('should group sensors by hardware key', () => {
            const sensors = [
                { sensorType: 'scd41:co2', updatedAt: new Date('2024-01-01T12:00:00Z') },
                { sensorType: 'scd41:temperature', updatedAt: new Date('2024-01-01T11:59:00Z') },
                { sensorType: 'scd41:humidity', updatedAt: new Date('2024-01-01T11:58:00Z') },
            ]

            const result = groupSensorsByHardware(sensors)

            expect(result.get('scd41')).toBe(new Date('2024-01-01T12:00:00Z').getTime())
        })

        it('should handle sensors without composite keys', () => {
            const sensors = [
                { sensorType: 'temperature', updatedAt: new Date('2024-01-01T12:00:00Z') },
            ]

            const result = groupSensorsByHardware(sensors)

            expect(result.get('temperature')).toBe(new Date('2024-01-01T12:00:00Z').getTime())
        })

        it('should use most recent timestamp per hardware', () => {
            const sensors = [
                { sensorType: 'sps30:pm1', updatedAt: new Date('2024-01-01T11:58:00Z') },
                { sensorType: 'sps30:pm25', updatedAt: new Date('2024-01-01T12:00:00Z') }, // Most recent
                { sensorType: 'sps30:pm4', updatedAt: new Date('2024-01-01T11:59:00Z') },
                { sensorType: 'sps30:pm10', updatedAt: new Date('2024-01-01T11:57:00Z') },
            ]

            const result = groupSensorsByHardware(sensors)

            expect(result.get('sps30')).toBe(new Date('2024-01-01T12:00:00Z').getTime())
        })

        it('should handle null updatedAt', () => {
            const sensors = [
                { sensorType: 'sgp30:eco2', updatedAt: null },
                { sensorType: 'sgp30:tvoc', updatedAt: new Date('2024-01-01T12:00:00Z') },
            ]

            const result = groupSensorsByHardware(sensors)

            expect(result.get('sgp30')).toBe(new Date('2024-01-01T12:00:00Z').getTime())
        })

        it('should handle multiple hardware types', () => {
            const sensors = [
                { sensorType: 'scd41:co2', updatedAt: new Date('2024-01-01T12:00:00Z') },
                { sensorType: 'sgp40:voc', updatedAt: new Date('2024-01-01T11:59:00Z') },
                { sensorType: 'bmp280:pressure', updatedAt: new Date('2024-01-01T11:58:00Z') },
            ]

            const result = groupSensorsByHardware(sensors)

            expect(result.size).toBe(3)
            expect(result.get('scd41')).toBeDefined()
            expect(result.get('sgp40')).toBeDefined()
            expect(result.get('bmp280')).toBeDefined()
        })
    })
})
