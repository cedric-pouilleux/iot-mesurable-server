/**
 * Device Service - Pure business logic for device data transformation
 *
 * This module contains testable pure functions for building device responses.
 * No dependencies on Fastify or database.
 */

import type {
    DeviceStatus,
    SystemInfo,
    HardwareInfo,
    SensorStatusInfo,
    SensorConfigInfo,
    SensorDataPoint,
} from '../../types/api'

// ============================================================================
// Types for raw database rows
// ============================================================================

export interface DeviceStatusRow {
    moduleId: string
    ip: string | null
    mac: string | null
    bootedAt: Date | null
    rssi: number | null
    flashUsedKb: number | null
    flashFreeKb: number | null
    flashSystemKb: number | null
    heapTotalKb: number | null
    heapFreeKb: number | null
    heapMinFreeKb: number | null
    chipModel?: string | null
    chipRev?: number | null
    cpuFreqMhz?: number | null
    flashKb?: number | null
    cores?: number | null
    preferences?: Record<string, unknown> | null
    zoneName?: string | null
    moduleType?: string | null
}

export interface SensorStatusRowInput {
    sensorType: string
    status: string | null
    value: number | null
}

export interface SensorConfigRowInput {
    sensorType: string
    intervalSeconds: number | null
    model: string | null
}

export interface HistoryRowInput {
    time: Date
    sensorType: string
    hardwareId: string | null
    value: number
}

// ============================================================================
// Pure Transformation Functions
// ============================================================================

/**
 * Build system info from raw status row
 */
export function buildSystemInfo(row: DeviceStatusRow): SystemInfo {
    return {
        ip: row.ip,
        mac: row.mac,
        bootedAt: row.bootedAt?.toISOString() ?? null,
        rssi: row.rssi,
        flash: {
            usedKb: row.flashUsedKb,
            freeKb: row.flashFreeKb,
            systemKb: row.flashSystemKb,
        },
        memory: {
            heapTotalKb: row.heapTotalKb,
            heapFreeKb: row.heapFreeKb,
            heapMinFreeKb: row.heapMinFreeKb,
        },
    }
}

/**
 * Build hardware info from raw status row
 */
export function buildHardwareInfo(row: DeviceStatusRow): HardwareInfo | null {
    if (!row.chipModel) {
        return null
    }

    return {
        chip: {
            model: row.chipModel,
            rev: row.chipRev ?? null,
            cpuFreqMhz: row.cpuFreqMhz ?? null,
            flashKb: row.flashKb ?? null,
            cores: row.cores ?? null,
        },
    }
}

/**
 * Transform sensor status rows to API format
 */
export function buildSensorsStatus(
    rows: SensorStatusRowInput[]
): Record<string, SensorStatusInfo> {
    const result: Record<string, SensorStatusInfo> = {}

    for (const row of rows) {
        result[row.sensorType] = {
            status: row.status ?? 'unknown',
            value: row.value,
        }
    }

    return result
}

/**
 * Transform sensor config rows to API format
 */
export function buildSensorsConfig(
    rows: SensorConfigRowInput[]
): { sensors: Record<string, SensorConfigInfo> } {
    const sensors: Record<string, SensorConfigInfo> = {}

    for (const row of rows) {
        sensors[row.sensorType] = {
            interval: row.intervalSeconds,
            model: row.model,
        }
    }

    return { sensors }
}

/**
 * Build complete device status from all raw data
 *
 * This is a pure function that transforms database rows into API response format.
 */
export function buildDeviceStatus(
    statusRow: DeviceStatusRow | null,
    sensorStatusRows: SensorStatusRowInput[],
    sensorConfigRows: SensorConfigRowInput[]
): DeviceStatus {
    const status: DeviceStatus = {}

    if (statusRow) {
        status.system = buildSystemInfo(statusRow)

        const hardware = buildHardwareInfo(statusRow)
        if (hardware) {
            status.hardware = hardware
            status.preferences = (statusRow.preferences as Record<string, unknown>) || {}
        }

        if (statusRow.zoneName) {
            status.zoneName = statusRow.zoneName
        }

        if (statusRow.moduleType) {
            status.moduleType = statusRow.moduleType
        }
    }

    status.sensors = buildSensorsStatus(sensorStatusRows)
    status.sensorsConfig = buildSensorsConfig(sensorConfigRows)

    return status
}

/**
 * Build composite key for sensor history
 * Format: hardware_id:sensor_type (normalized to lowercase)
 */
export function buildSensorKey(hardwareId: string | null, sensorType: string): string {
    const sensorTypeLow = sensorType.toLowerCase()

    if (hardwareId && hardwareId !== 'unknown') {
        return `${hardwareId.toLowerCase()}:${sensorTypeLow}`
    }

    return sensorTypeLow
}

/**
 * Transform history rows into grouped sensor data
 *
 * @param rows - Raw measurement rows from database
 * @returns Sensors grouped by composite key (hardware:type)
 */
export function buildSensorHistory(
    rows: HistoryRowInput[]
): Record<string, SensorDataPoint[]> {
    const sensors: Record<string, SensorDataPoint[]> = {}

    for (const row of rows) {
        const key = buildSensorKey(row.hardwareId, row.sensorType)
        const dataPoint: SensorDataPoint = { time: row.time, value: row.value }

        if (!sensors[key]) {
            sensors[key] = []
        }
        sensors[key].push(dataPoint)
    }

    return sensors
}

/**
 * Calculate bucket size for time-series aggregation
 *
 * @param days - Number of days of history
 * @param requestedBucket - Requested bucket size ('auto', 'raw', '1m', '5m', '15m', '1h')
 * @returns Bucket size in seconds, or null for raw data
 */
export function calculateBucketSize(days: number, requestedBucket: string = 'auto'): number | null {
    if (requestedBucket === 'raw') {
        return null
    }

    if (requestedBucket !== 'auto') {
        // Parse explicit bucket sizes
        const bucketMap: Record<string, number> = {
            '1m': 60,
            '5m': 300,
            '15m': 900,
            '1h': 3600,
        }
        return bucketMap[requestedBucket] ?? null
    }

    // Auto bucket selection based on time range
    if (days <= 1) {
        return null // Raw data for 1 day
    }
    if (days <= 7) {
        return 300 // 5 minutes
    }
    if (days <= 30) {
        return 900 // 15 minutes
    }
    return 3600 // 1 hour for longer periods
}
