import { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { eq, and } from 'drizzle-orm'
import * as schema from '../../db/schema'
import { HealthService, DataGap } from './healthService'

/**
 * Service to periodically detect and log data gaps
 * Runs as a background task to monitor connection health
 */
export class GapDetectionService {
    private healthService: HealthService
    private isRunning = false
    private intervalId: NodeJS.Timeout | null = null

    constructor(
        private db: NodePgDatabase<typeof schema>,
        private logger: any
    ) {
        this.healthService = new HealthService(db)
    }

    /**
     * Start the gap detection service
     * Runs every intervalMinutes to check for gaps
     */
    start(intervalMinutes: number = 15) {
        if (this.isRunning) {
            this.logger.warn('Gap detection service already running')
            return
        }

        this.isRunning = true
        this.logger.info(`🔍 Gap detection service started (interval: ${intervalMinutes}m)`)

        // Run immediately on start
        this.detectAndLogGaps()

        // Then run periodically
        this.intervalId = setInterval(
            () => this.detectAndLogGaps(),
            intervalMinutes * 60 * 1000
        )
    }

    /**
     * Stop the gap detection service
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId)
            this.intervalId = null
        }
        this.isRunning = false
        this.logger.info('🔍 Gap detection service stopped')
    }

    /**
     * Detect gaps for all devices and log them
     */
    private async detectAndLogGaps() {
        try {
            this.logger.debug('🔍 Running gap detection...')

            // Get all enabled sensor configurations
            const configs = await this.db
                .select()
                .from(schema.sensorConfig)
                .where(eq(schema.sensorConfig.enabled, true))

            // Group by module
            const moduleConfigs = new Map<string, typeof configs>()
            for (const config of configs) {
                const existing = moduleConfigs.get(config.moduleId) || []
                existing.push(config)
                moduleConfigs.set(config.moduleId, existing)
            }

            let totalGaps = 0
            const gapsByModule: Record<string, DataGap[]> = {}

            // Detect gaps for each module's sensors
            for (const [moduleId, sensorConfigs] of moduleConfigs) {
                const moduleGaps: DataGap[] = []

                for (const config of sensorConfigs) {
                    // Check last 1 hour for ongoing gaps
                    const gaps = await this.healthService.detectGaps(
                        moduleId,
                        config.sensorType,
                        1 // last hour
                    )

                    // Only log gaps that are currently ongoing (end time is recent)
                    const now = Date.now()
                    const ongoingGaps = gaps.filter((gap) => {
                        const gapEndMs = gap.gapEnd.getTime()
                        const timeSinceGapEnd = now - gapEndMs
                        // Consider it ongoing if gap ended less than expected interval ago
                        return timeSinceGapEnd < (gap.expectedIntervalSeconds || 60) * 1000
                    })

                    moduleGaps.push(...ongoingGaps)
                    totalGaps += ongoingGaps.length
                }

                if (moduleGaps.length > 0) {
                    gapsByModule[moduleId] = moduleGaps
                }
            }

            // Log summary
            if (totalGaps > 0) {
                this.logger.warn({
                    msg: `⚠️ Detected ${totalGaps} ongoing data gaps across ${Object.keys(gapsByModule).length} devices`,
                    category: 'DATA_GAP',
                    source: 'SYSTEM',
                    details: {
                        totalGaps,
                        affectedDevices: Object.keys(gapsByModule).length,
                        gaps: gapsByModule,
                    },
                })

                // Log each gap individually to system_logs table
                for (const [moduleId, gaps] of Object.entries(gapsByModule)) {
                    for (const gap of gaps) {
                        await this.logGap(moduleId, gap)
                    }
                }
            } else {
                this.logger.debug('✅ No ongoing data gaps detected')
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error'
            this.logger.error(`Error in gap detection: ${errorMessage}`)
        }
    }

    /**
     * Log a gap to the system_logs table
     */
    private async logGap(moduleId: string, gap: DataGap) {
        try {
            await this.db.insert(schema.systemLogs).values({
                category: 'DATA_GAP',
                source: 'SYSTEM',
                direction: null,
                level: 'warn',
                msg: `Data gap detected: ${gap.sensorType} (${gap.hardwareId})`,
                time: new Date(),
                details: {
                    moduleId,
                    sensorType: gap.sensorType,
                    hardwareId: gap.hardwareId,
                    gapStart: gap.gapStart.toISOString(),
                    gapEnd: gap.gapEnd.toISOString(),
                    gapDurationMinutes: gap.gapDurationMinutes,
                    expectedIntervalSeconds: gap.expectedIntervalSeconds,
                },
            })
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error'
            this.logger.error(`Failed to log gap: ${errorMessage}`)
        }
    }

    /**
     * Get gap statistics for the last N hours
     */
    async getGapStats(hours: number = 24) {
        const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000)

        const result = await this.db
            .select()
            .from(schema.systemLogs)
            .where(
                and(
                    eq(schema.systemLogs.category, 'DATA_GAP'),
                    eq(schema.systemLogs.source, 'SYSTEM')
                )
            )

        const gaps = result.filter(
            (log) => log.time && log.time.getTime() >= cutoffDate.getTime()
        )

        return {
            totalGaps: gaps.length,
            gapsByModule: gaps.reduce(
                (acc, log) => {
                    const moduleId = (log.details as any)?.moduleId
                    if (moduleId) {
                        acc[moduleId] = (acc[moduleId] || 0) + 1
                    }
                    return acc
                },
                {} as Record<string, number>
            ),
            recentGaps: gaps.slice(0, 10).map((log) => ({
                time: log.time,
                message: log.msg,
                details: log.details,
            })),
        }
    }
}
