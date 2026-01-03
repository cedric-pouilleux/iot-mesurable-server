import type { SensorStatusCalculationParams, SensorStatus } from './types'

/**
 * Calculate sensor status based on interval-aware logic
 * 
 * Rules:
 * - If never received data (lastUpdate = null) → 'unknown'
 * - If no data for more than 2× interval + 10s grace → 'missing'
 * - Otherwise → 'ok'
 */
export function calculateSensorStatus(params: SensorStatusCalculationParams): SensorStatus['status'] {
    const { lastUpdate, intervalSeconds, now = Date.now() } = params

    const GRACE_PERIOD_MS = 10000  // 10 seconds
    const DEFAULT_INTERVAL_S = 60   // Default 60s if not configured

    // Never received data
    if (!lastUpdate) {
        return 'unknown'
    }

    const interval = intervalSeconds || DEFAULT_INTERVAL_S
    const timeoutMs = (interval * 2 * 1000) + GRACE_PERIOD_MS
    const lastUpdateMs = lastUpdate.getTime()
    const elapsed = now - lastUpdateMs

    // Timeout exceeded
    if (elapsed > timeoutMs) {
        return 'missing'
    }

    // Within timeout
    return 'ok'
}

/**
 * Group sensors by hardware and find most recent update per hardware
 */
export function groupSensorsByHardware(
    sensors: Array<{ sensorType: string; updatedAt: Date | null }>
): Map<string, number> {
    const hardwareLastUpdate = new Map<string, number>()

    sensors.forEach(sensor => {
        const hardwareKey = sensor.sensorType.includes(':')
            ? sensor.sensorType.split(':')[0]
            : sensor.sensorType

        const currentTime = sensor.updatedAt?.getTime() || 0
        const existingTime = hardwareLastUpdate.get(hardwareKey) || 0

        if (currentTime > existingTime) {
            hardwareLastUpdate.set(hardwareKey, currentTime)
        }
    })

    return hardwareLastUpdate
}
