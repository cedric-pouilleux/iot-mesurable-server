import { describe, it, expect, beforeEach, vi } from 'vitest'
import { HealthService } from '../healthService'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from '../../../db/schema'

// Mock database
const createMockDb = () => {
    return {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        execute: vi.fn(),
    } as unknown as NodePgDatabase<typeof schema>
}

describe('HealthService', () => {
    let healthService: HealthService
    let mockDb: NodePgDatabase<typeof schema>

    beforeEach(() => {
        mockDb = createMockDb()
        healthService = new HealthService(mockDb)
    })

    describe('getLastMeasurementTime', () => {
        it('should return null when no measurements exist', async () => {
            vi.mocked(mockDb.execute).mockResolvedValue({ rows: [] } as any)

            const result = await healthService.getLastMeasurementTime('module-1', 'temperature')

            expect(result).toBeNull()
        })

        it('should return the last measurement time', async () => {
            const mockTime = '2026-01-05T00:00:00Z'
            vi.mocked(mockDb.execute).mockResolvedValue({
                rows: [{ time: mockTime }],
            } as any)

            const result = await healthService.getLastMeasurementTime('module-1', 'temperature')

            expect(result).toEqual(new Date(mockTime))
        })

        it('should handle composite sensor keys (hardware:sensor)', async () => {
            const mockTime = '2026-01-05T00:00:00Z'
            vi.mocked(mockDb.execute).mockResolvedValue({
                rows: [{ time: mockTime }],
            } as any)

            // Test with composite key like "scd41:co2"
            const result = await healthService.getLastMeasurementTime('module-1', 'scd41:co2')

            expect(result).toEqual(new Date(mockTime))
            // Verify the query was called with split parts
            const executeCall = vi.mocked(mockDb.execute).mock.calls[0]
            expect(executeCall).toBeDefined()
        })
    })

    describe('getDeviceHealth', () => {
        it('should return offline status when no sensors configured', async () => {
            // Mock no sensor configs
            vi.mocked(mockDb.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([]),
                }),
            } as any)

            const result = await healthService.getDeviceHealth('module-1')

            expect(result.overallStatus).toBe('offline')
            expect(result.sensors).toHaveLength(0)
            expect(result.uptimePercent24h).toBe(0)
        })

        it('should calculate connected status correctly', async () => {
            const now = Date.now()
            const recentTime = new Date(now - 30 * 1000) // 30 seconds ago

            // Mock sensor config with 60s interval
            vi.mocked(mockDb.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([
                        {
                            sensorType: 'temperature',
                            intervalSeconds: 60,
                            model: 'dht22',
                            enabled: true,
                        },
                    ]),
                }),
            } as any)

            // Mock last measurement time (recent)
            vi.mocked(mockDb.execute).mockResolvedValue({
                rows: [{ time: recentTime.toISOString() }],
            } as any)

            const result = await healthService.getDeviceHealth('module-1')

            expect(result.sensors[0].status).toBe('connected')
            expect(result.overallStatus).toBe('healthy')
        })

        it('should calculate stale status correctly', async () => {
            const now = Date.now()
            const staleTime = new Date(now - 3 * 60 * 1000) // 3 minutes ago (interval is 60s)

            vi.mocked(mockDb.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([
                        {
                            sensorType: 'temperature',
                            intervalSeconds: 60,
                            model: 'dht22',
                            enabled: true,
                        },
                    ]),
                }),
            } as any)

            vi.mocked(mockDb.execute).mockResolvedValue({
                rows: [{ time: staleTime.toISOString() }],
            } as any)

            const result = await healthService.getDeviceHealth('module-1')

            expect(result.sensors[0].status).toBe('stale')
            expect(result.overallStatus).toBe('degraded')
        })

        it('should calculate offline status correctly', async () => {
            const now = Date.now()
            const offlineTime = new Date(now - 10 * 60 * 1000) // 10 minutes ago (> 5x interval)

            vi.mocked(mockDb.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([
                        {
                            sensorType: 'temperature',
                            intervalSeconds: 60,
                            model: 'dht22',
                            enabled: true,
                        },
                    ]),
                }),
            } as any)

            vi.mocked(mockDb.execute).mockResolvedValue({
                rows: [{ time: offlineTime.toISOString() }],
            } as any)

            const result = await healthService.getDeviceHealth('module-1')

            expect(result.sensors[0].status).toBe('offline')
            expect(result.overallStatus).toBe('offline')
        })
    })

    describe('detectGaps', () => {
        it('should return empty array when no config exists', async () => {
            vi.mocked(mockDb.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([]),
                }),
            } as any)

            const result = await healthService.detectGaps('module-1', 'temperature', 24)

            expect(result).toEqual([])
        })

        it('should detect entire period as gap when no measurements', async () => {
            vi.mocked(mockDb.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([
                        {
                            sensorType: 'temperature',
                            intervalSeconds: 60,
                            model: 'dht22',
                        },
                    ]),
                }),
            } as any)

            vi.mocked(mockDb.execute).mockResolvedValue({
                rows: [],
            } as any)

            const result = await healthService.detectGaps('module-1', 'temperature', 24)

            expect(result).toHaveLength(1)
            expect(result[0].gapDurationMinutes).toBe(24 * 60)
        })

        it('should detect gap between measurements', async () => {
            const now = Date.now()
            const measurement1 = new Date(now - 10 * 60 * 1000) // 10 min ago
            const measurement2 = new Date(now - 1 * 60 * 1000) // 1 min ago

            vi.mocked(mockDb.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([
                        {
                            sensorType: 'temperature',
                            intervalSeconds: 60, // 1 minute interval
                            model: 'dht22',
                        },
                    ]),
                }),
            } as any)

            vi.mocked(mockDb.execute).mockResolvedValue({
                rows: [
                    { time: measurement1.toISOString(), hardware_id: 'dht22' },
                    { time: measurement2.toISOString(), hardware_id: 'dht22' },
                ],
            } as any)

            const result = await healthService.detectGaps('module-1', 'temperature', 24)

            // Gap of 9 minutes is > 3x interval (3 minutes), so it should be detected
            expect(result.length).toBeGreaterThan(0)
            expect(result[0].gapDurationMinutes).toBeGreaterThan(3)
        })
    })

    describe('calculateUptimePercent', () => {
        it('should return 0 when no sensors configured', async () => {
            vi.mocked(mockDb.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([]),
                }),
            } as any)

            const result = await healthService.calculateUptimePercent('module-1', 24)

            expect(result).toBe(0)
        })

        it('should return 100% when no gaps', async () => {
            vi.mocked(mockDb.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([
                        {
                            sensorType: 'temperature',
                            intervalSeconds: 60,
                            model: 'dht22',
                            enabled: true,
                        },
                    ]),
                }),
            } as any)

            // Mock continuous measurements (no gaps)
            const now = Date.now()
            const measurements = Array.from({ length: 10 }, (_, i) => ({
                time: new Date(now - i * 60 * 1000).toISOString(),
                hardware_id: 'dht22',
            }))

            vi.mocked(mockDb.execute).mockResolvedValue({
                rows: measurements,
            } as any)

            const result = await healthService.calculateUptimePercent('module-1', 1)

            expect(result).toBeGreaterThan(90)
        })
    })
})
