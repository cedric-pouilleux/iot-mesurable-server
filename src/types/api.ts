/**
 * API Response types - Types for API responses
 * These types are derived from Drizzle schema types where possible
 */

import type { InferSelectModel } from 'drizzle-orm'
import type {
  deviceSystemStatus,
  deviceHardware,
  sensorStatus,
  sensorConfig,
  measurements,
} from '../db/schema'

// Types générés depuis Drizzle
export type DeviceSystemStatusRow = InferSelectModel<typeof deviceSystemStatus>
export type DeviceHardwareRow = InferSelectModel<typeof deviceHardware>
export type SensorStatusRow = InferSelectModel<typeof sensorStatus>
export type SensorConfigRow = InferSelectModel<typeof sensorConfig>
export type MeasurementRow = InferSelectModel<typeof measurements>

// Types API dérivés des types DB
export interface SystemInfo {
  ip: DeviceSystemStatusRow['ip']
  mac: DeviceSystemStatusRow['mac']
  bootedAt: string | null  // ISO timestamp when ESP32 last booted
  rssi: DeviceSystemStatusRow['rssi']
  flash: {
    usedKb: DeviceSystemStatusRow['flashUsedKb']
    freeKb: DeviceSystemStatusRow['flashFreeKb']
    systemKb: DeviceSystemStatusRow['flashSystemKb']
  }
  memory: {
    heapTotalKb: DeviceSystemStatusRow['heapTotalKb']
    heapFreeKb: DeviceSystemStatusRow['heapFreeKb']
    heapMinFreeKb: DeviceSystemStatusRow['heapMinFreeKb']
  }
}

export interface HardwareInfo {
  chip: {
    model: DeviceHardwareRow['chipModel']
    rev: DeviceHardwareRow['chipRev']
    cpuFreqMhz: DeviceHardwareRow['cpuFreqMhz']
    flashKb: DeviceHardwareRow['flashKb']
    cores: DeviceHardwareRow['cores']
  }
}

export interface SensorStatusInfo {
  status: string // Non-nullable pour l'API (null devient 'unknown')
  value: SensorStatusRow['value']
}

export interface SensorConfigInfo {
  interval: SensorConfigRow['intervalSeconds']
  model: SensorConfigRow['model']
}

export interface DeviceStatus {
  system?: SystemInfo
  hardware?: HardwareInfo
  sensors?: Record<string, SensorStatusInfo>
  sensorsConfig?: {
    sensors: Record<string, SensorConfigInfo> 
  }
  preferences?: Record<string, any>
  zoneName?: string | null
  moduleType?: string | null
}

export interface SensorDataPoint {
  time: Date
  value: number
}

export interface ModuleDataResponse {
  status: DeviceStatus
  sensors: {
    co2: SensorDataPoint[]
    temp: SensorDataPoint[]
    hum: SensorDataPoint[]
    voc: SensorDataPoint[] 
    pressure: SensorDataPoint[]
    temperature_bmp: SensorDataPoint[]
    pm1: SensorDataPoint[]
    pm25: SensorDataPoint[]
    pm4: SensorDataPoint[]
    pm10: SensorDataPoint[]
    eco2: SensorDataPoint[]
    tvoc: SensorDataPoint[]
    temp_sht: SensorDataPoint[]
    hum_sht: SensorDataPoint[]
  }  
}

export interface ModuleListItem {
  id: string
  name: string
  type: string
  status: null
}

export interface ConfigUpdateResponse {
  success: boolean
  message: string
}

export interface DbSizeResponse {
  totalSize: string
  totalSizeBytes: number
}

export interface MetricsHistoryResponse {
  history: Array<{
    time: Date | string
    codeSizeKb: number | null
    dbSizeBytes: string | number
  }>
  count: number
  periodDays: number
}
