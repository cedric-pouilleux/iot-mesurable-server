import { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { sql, eq, and, gte } from 'drizzle-orm'
import * as schema from '../../db/schema'

export interface SensorHealthStatus {
    sensorType: string
    hardwareId?: string
    status: 'connected' | 'stale' | 'offline'
    lastMeasurement: Date | null
    timeSinceLastMeasurement: number | null // milliseconds
    expectedIntervalSeconds: number | null
    gapCount: number
    longestGapMinutes: number | null
}

export interface DeviceHealthStatus {
    moduleId: string
    overallStatus: 'healthy' | 'degraded' | 'offline'
    uptimePercent24h: number
    sensors: SensorHealthStatus[]
    lastUpdate: Date
}

export interface DataGap {
    sensorType: string
    hardwareId: string
    gapStart: Date
    gapEnd: Date
    gapDurationMinutes: number
    expectedIntervalSeconds: number
}

export class HealthService {
    constructor(private db: NodePgDatabase<typeof schema>) { }

    /**
     * Get comprehensive health status for a device
     */
    async getDeviceHealth(moduleId: string): Promise<DeviceHealthStatus> {
        // Get sensor configurations to know expected intervals
        const configs = await this.db
            .select()
            .from(schema.sensorConfig)
            .where(and(eq(schema.sensorConfig.moduleId, moduleId), eq(schema.sensorConfig.enabled, true)))

        // Get last measurement for each sensor
        const sensorHealthPromises = configs.map(async (config) => {
            const lastMeasurement = await this.getLastMeasurementTime(
                moduleId,
                config.sensorType
            )

            const timeSinceLastMs = lastMeasurement
                ? Date.now() - lastMeasurement.getTime()
                : null

            // Determine status based on interval
            let status: 'connected' | 'stale' | 'offline' = 'offline'
            if (timeSinceLastMs !== null && config.intervalSeconds) {
                const intervalMs = config.intervalSeconds * 1000
                if (timeSinceLastMs < intervalMs * 2) {
                    status = 'connected' // Within 2x interval
                } else if (timeSinceLastMs < intervalMs * 5) {
                    status = 'stale' // Between 2x and 5x interval
                } else {
                    status = 'offline' // More than 5x interval
                }
            }

            // Get gap statistics for last 24 hours
            const gaps = await this.detectGaps(moduleId, config.sensorType, 24)
            const gapCount = gaps.length
            const longestGapMinutes =
                gaps.length > 0
                    ? Math.max(...gaps.map((g) => g.gapDurationMinutes))
                    : null

            return {
                sensorType: config.sensorType,
                hardwareId: config.model || undefined,
                status,
                lastMeasurement,
                timeSinceLastMeasurement: timeSinceLastMs,
                expectedIntervalSeconds: config.intervalSeconds,
                gapCount,
                longestGapMinutes,
            }
        })

        const sensors = await Promise.all(sensorHealthPromises)

        // Calculate overall status
        const connectedCount = sensors.filter((s) => s.status === 'connected').length
        const totalCount = sensors.length
        let overallStatus: 'healthy' | 'degraded' | 'offline' = 'offline'

        if (totalCount === 0) {
            overallStatus = 'offline'
        } else if (connectedCount === totalCount) {
            overallStatus = 'healthy'
        } else if (connectedCount > 0) {
            overallStatus = 'degraded'
        } else {
            overallStatus = 'offline'
        }

        // Calculate uptime percentage for last 24 hours
        const uptimePercent24h = await this.calculateUptimePercent(moduleId, 24)

        return {
            moduleId,
            overallStatus,
            uptimePercent24h,
            sensors,
            lastUpdate: new Date(),
        }
    }

    /**
     * Get the timestamp of the most recent measurement for a sensor
     * Handles composite keys like "scd41:co2" by extracting hardware and sensor parts
     */
    async getLastMeasurementTime(
        moduleId: string,
        sensorType: string
    ): Promise<Date | null> {
        // sensor_config stores composite keys like "scd41:co2"
        // measurements table stores sensor_type as extracted part (e.g., "co2") 
        // with hardware_id separately (e.g., "scd41")

        let hardwareId: string | null = null
        let actualSensorType = sensorType

        // If it's a composite key, split it
        if (sensorType.includes(':')) {
            const parts = sensorType.split(':')
            hardwareId = parts[0]
            actualSensorType = parts[1]
        }

        // Query with or without hardware filter
        let query
        if (hardwareId) {
            query = sql`
        SELECT time
        FROM measurements
        WHERE module_id = ${moduleId} 
          AND sensor_type = ${actualSensorType}
          AND hardware_id = ${hardwareId}
        ORDER BY time DESC
        LIMIT 1
      `
        } else {
            query = sql`
        SELECT time
        FROM measurements
        WHERE module_id = ${moduleId} AND sensor_type = ${actualSensorType}
        ORDER BY time DESC
        LIMIT 1
      `
        }

        const result = await this.db.execute<{ time: string }>(query)

        if (result.rows.length === 0) return null
        return new Date(result.rows[0].time)
    }

    /**
     * Detect data gaps for a sensor over a time period
     * A gap is defined as a period where no measurements were received
     * when measurements were expected based on the configured interval
     */
    async detectGaps(
        moduleId: string,
        sensorType: string,
        hours: number
    ): Promise<DataGap[]> {
        const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000)

        // Get the configured interval for this sensor
        const config = await this.db
            .select()
            .from(schema.sensorConfig)
            .where(
                and(
                    eq(schema.sensorConfig.moduleId, moduleId),
                    eq(schema.sensorConfig.sensorType, sensorType)
                )
            )
            .limit(1)

        if (config.length === 0 || !config[0].intervalSeconds) {
            return [] // No config or interval, can't detect gaps
        }

        const intervalSeconds = config[0].intervalSeconds
        const intervalMs = intervalSeconds * 1000

        // Handle composite sensor keys
        let hardwareId: string | null = null
        let actualSensorType = sensorType

        if (sensorType.includes(':')) {
            const parts = sensorType.split(':')
            hardwareId = parts[0]
            actualSensorType = parts[1]
        }

        // Get all measurements for this sensor in the time period
        let query
        if (hardwareId) {
            query = sql`
        SELECT time, hardware_id
        FROM measurements
        WHERE module_id = ${moduleId} 
          AND sensor_type = ${actualSensorType}
          AND hardware_id = ${hardwareId}
          AND time > ${cutoffDate}
        ORDER BY time ASC
      `
        } else {
            query = sql`
        SELECT time, hardware_id
        FROM measurements
        WHERE module_id = ${moduleId} 
          AND sensor_type = ${actualSensorType}
          AND time > ${cutoffDate}
        ORDER BY time ASC
      `
        }

        const measurements = await this.db.execute<{
            time: string
            hardware_id: string
        }>(query)

        const gaps: DataGap[] = []

        if (measurements.rows.length === 0) {
            // No measurements at all - entire period is a gap
            return [
                {
                    sensorType,
                    hardwareId: config[0].model || hardwareId || 'unknown',
                    gapStart: cutoffDate,
                    gapEnd: new Date(),
                    gapDurationMinutes: hours * 60,
                    expectedIntervalSeconds: intervalSeconds,
                },
            ]
        }

        // Check gaps between consecutive measurements
        for (let i = 0; i < measurements.rows.length - 1; i++) {
            const current = new Date(measurements.rows[i].time)
            const next = new Date(measurements.rows[i + 1].time)
            const gapMs = next.getTime() - current.getTime()

            // If gap is more than 3x the expected interval, it's considered a gap
            if (gapMs > intervalMs * 3) {
                gaps.push({
                    sensorType,
                    hardwareId: measurements.rows[i].hardware_id,
                    gapStart: current,
                    gapEnd: next,
                    gapDurationMinutes: Math.round(gapMs / 1000 / 60),
                    expectedIntervalSeconds: intervalSeconds,
                })
            }
        }

        // Check if there's a gap from the last measurement to now
        const lastMeasurement = new Date(
            measurements.rows[measurements.rows.length - 1].time
        )
        const gapFromLastMs = Date.now() - lastMeasurement.getTime()

        if (gapFromLastMs > intervalMs * 3) {
            gaps.push({
                sensorType,
                hardwareId:
                    measurements.rows[measurements.rows.length - 1].hardware_id,
                gapStart: lastMeasurement,
                gapEnd: new Date(),
                gapDurationMinutes: Math.round(gapFromLastMs / 1000 / 60),
                expectedIntervalSeconds: intervalSeconds,
            })
        }

        return gaps
    }

    /**
     * Calculate uptime percentage over a time period
     * Uptime is defined as the percentage of time where at least one sensor
     * is reporting measurements as expected
     */
    async calculateUptimePercent(
        moduleId: string,
        hours: number
    ): Promise<number> {
        const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000)

        // Get all enabled sensors for this module
        const configs = await this.db
            .select()
            .from(schema.sensorConfig)
            .where(
                and(
                    eq(schema.sensorConfig.moduleId, moduleId),
                    eq(schema.sensorConfig.enabled, true)
                )
            )

        if (configs.length === 0) return 0

        // For each sensor, calculate its uptime
        const uptimePromises = configs.map(async (config) => {
            if (!config.intervalSeconds) return 0

            const gaps = await this.detectGaps(moduleId, config.sensorType, hours)
            const totalGapMinutes = gaps.reduce(
                (sum, gap) => sum + gap.gapDurationMinutes,
                0
            )
            const totalMinutes = hours * 60
            const uptimeMinutes = totalMinutes - totalGapMinutes

            return Math.max(0, Math.min(100, (uptimeMinutes / totalMinutes) * 100))
        })

        const uptimes = await Promise.all(uptimePromises)

        // Return the average uptime across all sensors
        if (uptimes.length === 0) return 0
        const avgUptime = uptimes.reduce((sum, u) => sum + u, 0) / uptimes.length

        return Math.round(avgUptime * 10) / 10 // Round to 1 decimal place
    }

    /**
     * Get all devices with poor health (offline or degraded)
     */
    async getUnhealthyDevices(): Promise<
        Array<{ moduleId: string; status: 'degraded' | 'offline' }>
    > {
        const allModules = await this.db
            .selectDistinct({
                moduleId: schema.deviceSystemStatus.moduleId,
            })
            .from(schema.deviceSystemStatus)

        const unhealthyDevices: Array<{
            moduleId: string
            status: 'degraded' | 'offline'
        }> = []

        for (const module of allModules) {
            const health = await this.getDeviceHealth(module.moduleId)
            if (health.overallStatus !== 'healthy') {
                unhealthyDevices.push({
                    moduleId: module.moduleId,
                    status: health.overallStatus,
                })
            }
        }

        return unhealthyDevices
    }
}
