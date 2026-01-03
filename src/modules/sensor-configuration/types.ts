export interface SensorConfig {
    moduleId: string
    sensorType: string
    intervalSeconds: number | null
    model: string | null
    enabled: boolean
}

export interface SensorStatus {
    status: 'ok' | 'missing' | 'unknown'
    value: number | null
}

export interface SensorStatusCalculationParams {
    lastUpdate: Date | null
    intervalSeconds: number
    now?: number
}

export interface HardwareStatusMap {
    hardwareKey: string
    lastUpdate: number
    intervalMs: number
}
