import type { SensorConfig, SensorStatus } from './types'
import { calculateSensorStatus, groupSensorsByHardware } from './service'

export interface SensorStatusRow {
    sensorType: string
    status: string | null
    value: number | null
    updatedAt: Date | null
}

export interface SensorConfigRow {
    sensorType: string
    intervalSeconds: number | null
    model: string | null
}

/**
 * Build sensor statuses with interval-aware calculation
 * 
 * This function groups sensors by hardware and calculates status
 * based on the most recent update from ANY sensor of that hardware.
 */
export function buildSensorStatuses(
    statusRows: SensorStatusRow[],
    configRows: SensorConfigRow[]
): Record<string, SensorStatus> {
    // Build interval map from config (hardware-level)
    const intervalMap = new Map<string, number>()
    configRows.forEach(row => {
        if (row.intervalSeconds) {
            const hardwareKey = row.sensorType.includes(':')
                ? row.sensorType.split(':')[0]
                : row.sensorType
            intervalMap.set(hardwareKey, row.intervalSeconds)
        }
    })

    // Group sensors by hardware and find most recent update
    const hardwareLastUpdate = groupSensorsByHardware(statusRows)

    // Calculate status for each sensor
    const sensors: Record<string, SensorStatus> = {}
    const now = Date.now()

    statusRows.forEach(row => {
        const hardwareKey = row.sensorType.includes(':')
            ? row.sensorType.split(':')[0]
            : row.sensorType

        const intervalSeconds = intervalMap.get(hardwareKey) || 60
        const lastUpdateMs = hardwareLastUpdate.get(hardwareKey) || 0
        const lastUpdate = lastUpdateMs > 0 ? new Date(lastUpdateMs) : null

        const calculatedStatus = calculateSensorStatus({
            lastUpdate,
            intervalSeconds,
            now,
        })

        sensors[row.sensorType] = {
            status: calculatedStatus,
            value: row.value,
        }
    })

    return sensors
}
