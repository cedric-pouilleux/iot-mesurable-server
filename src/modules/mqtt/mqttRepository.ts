import { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { sql, eq } from 'drizzle-orm'
import * as schema from '../../db/schema'
import type {
  MqttMeasurement,
  SystemData,
  SystemConfigData,
  SensorsStatusData,
  SensorsConfigData,
  HardwareData,
  ModuleConfig,
} from '../../types/mqtt'

export class MqttRepository {
  constructor(private db: NodePgDatabase<typeof schema>) {}

  /**
   * Insert batch of measurements (optimized for TimescaleDB)
   */
  async insertMeasurementsBatch(measurements: MqttMeasurement[]): Promise<void> {
    if (measurements.length === 0) return

    try {
      // Use Drizzle batch insert for better performance
      // Note: onConflictDoUpdate() met à jour les doublons basés sur la clé primaire composite
      // (time, module_id, sensor_type, hardware_id)
      await this.db
        .insert(schema.measurements)
        .values(
          measurements.map(m => ({
            time: m.time,
            moduleId: m.moduleId,
            sensorType: m.sensorType,
            hardwareId: m.hardwareId,
            value: m.value,
          }))
        )
        .onConflictDoUpdate({
          target: [
            schema.measurements.time,
            schema.measurements.moduleId,
            schema.measurements.sensorType,
            schema.measurements.hardwareId,
          ],
          set: {
            value: sql`EXCLUDED.value`,
          },
        })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      // Log les premières mesures pour debug
      const sample = measurements.slice(0, 2).map(m => ({
        time: m.time.toISOString(),
        moduleId: m.moduleId,
        sensorType: m.sensorType,
        hardwareId: m.hardwareId,
        value: m.value,
      }))
      throw new Error(
        `Failed to insert measurements batch: ${errorMessage}. Sample: ${JSON.stringify(sample)}`
      )
    }
  }

  /**
   * Update system status (real-time data: rssi, memory)
   */
  async updateSystemStatus(moduleId: string, data: SystemData): Promise<void> {
    await this.db
      .insert(schema.deviceSystemStatus)
      .values({
        moduleId,
        rssi: data.rssi ?? null,
        heapFreeKb: data.memory?.heapFreeKb ?? null,
        heapMinFreeKb: data.memory?.heapMinFreeKb ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.deviceSystemStatus.moduleId,
        set: {
          rssi: sql`EXCLUDED.rssi`,
          heapFreeKb: sql`COALESCE(EXCLUDED.heap_free_kb, device_system_status.heap_free_kb)`,
          heapMinFreeKb: sql`COALESCE(EXCLUDED.heap_min_free_kb, device_system_status.heap_min_free_kb)`,
          updatedAt: sql`NOW()`,
        },
      })
  }

  /**
   * Update system configuration (static data: ip, mac, flash, etc.)
   * Now also handles rssi, heapFreeKb, heapMinFreeKb from new library format
   */
  async updateSystemConfig(moduleId: string, data: SystemConfigData): Promise<void> {
    // Calculate bootedAt from uptimeStart (seconds since boot)
    let uptimeSeconds: number | null = null
    if (typeof data.uptimeStart === 'number') {
      uptimeSeconds = data.uptimeStart
    } else if (typeof data.uptimeStart === 'string') {
      uptimeSeconds = parseInt(data.uptimeStart, 10)
      if (isNaN(uptimeSeconds)) uptimeSeconds = null
    }
    
    const bootedAt = uptimeSeconds !== null && uptimeSeconds >= 0
      ? new Date(Date.now() - uptimeSeconds * 1000)
      : null

    await this.db
      .insert(schema.deviceSystemStatus)
      .values({
        moduleId,
        moduleType: data.moduleType ?? null,
        ip: data.ip ?? null,
        mac: data.mac ?? null,
        bootedAt: bootedAt,
        rssi: data.rssi ?? null,
        flashUsedKb: data.flash?.usedKb ?? null,
        flashFreeKb: data.flash?.freeKb ?? null,
        flashSystemKb: data.flash?.totalKb ?? data.flash?.systemKb ?? null, // totalKb or legacy systemKb
        heapTotalKb: data.memory?.heapTotalKb ?? null,
        heapFreeKb: data.memory?.heapFreeKb ?? null,
        heapMinFreeKb: data.memory?.heapMinFreeKb ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.deviceSystemStatus.moduleId,
        set: {
          moduleType: sql`COALESCE(EXCLUDED.module_type, device_system_status.module_type)`,
          ip: sql`COALESCE(EXCLUDED.ip, device_system_status.ip)`,
          mac: sql`COALESCE(EXCLUDED.mac, device_system_status.mac)`,
          // bootedAt: update only if new value is not null, otherwise keep existing
          bootedAt: sql`COALESCE(EXCLUDED.booted_at, device_system_status.booted_at)`,
          rssi: sql`COALESCE(EXCLUDED.rssi, device_system_status.rssi)`,
          flashUsedKb: sql`COALESCE(EXCLUDED.flash_used_kb, device_system_status.flash_used_kb)`,
          flashFreeKb: sql`COALESCE(EXCLUDED.flash_free_kb, device_system_status.flash_free_kb)`,
          flashSystemKb: sql`COALESCE(EXCLUDED.flash_system_kb, device_system_status.flash_system_kb)`,
          heapTotalKb: sql`COALESCE(EXCLUDED.heap_total_kb, device_system_status.heap_total_kb)`,
          heapFreeKb: sql`COALESCE(EXCLUDED.heap_free_kb, device_system_status.heap_free_kb)`,
          heapMinFreeKb: sql`COALESCE(EXCLUDED.heap_min_free_kb, device_system_status.heap_min_free_kb)`,
          updatedAt: sql`NOW()`,
        },
      })
  }

  /**
   * Update sensor status (batch update for multiple sensors)
   */
  async updateSensorStatus(moduleId: string, data: SensorsStatusData): Promise<void> {
    const updates = Object.entries(data).map(([sensorType, sensor]) =>
      this.db
        .insert(schema.sensorStatus)
        .values({
          moduleId,
          sensorType,
          status: sensor.status,
          value: sensor.value,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [schema.sensorStatus.moduleId, schema.sensorStatus.sensorType],
          set: {
            status: sql`EXCLUDED.status`,
            value: sql`EXCLUDED.value`,
            updatedAt: sql`NOW()`,
          },
        })
    )

    await Promise.all(updates)
  }

  /**
   * Update sensor configuration (batch update for multiple sensors)
   */
  async updateSensorConfig(moduleId: string, data: SensorsConfigData): Promise<void> {
    const updates = Object.entries(data).map(([sensorType, sensor]) =>
      this.db
        .insert(schema.sensorConfig)
        .values({
          moduleId,
          sensorType,
          intervalSeconds: sensor.interval ?? null,
          model: sensor.model ?? null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [schema.sensorConfig.moduleId, schema.sensorConfig.sensorType],
          set: {
            intervalSeconds: sql`COALESCE(EXCLUDED.interval_seconds, sensor_config.interval_seconds)`,
            model: sql`COALESCE(EXCLUDED.model, sensor_config.model)`,
            updatedAt: sql`NOW()`,
          },
        })
    )

    await Promise.all(updates)
  }

  /**
   * Update hardware information
   */
  async updateHardware(moduleId: string, data: HardwareData): Promise<void> {
    await this.db
      .insert(schema.deviceHardware)
      .values({
        moduleId,
        chipModel: data.chip?.model ?? null,
        chipRev: data.chip?.rev ?? null,
        cpuFreqMhz: data.chip?.cpuFreqMhz ?? null,
        flashKb: data.chip?.flashKb ?? null,
        cores: data.chip?.cores ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.deviceHardware.moduleId,
        set: {
          chipModel: sql`EXCLUDED.chip_model`,
          chipRev: sql`EXCLUDED.chip_rev`,
          cpuFreqMhz: sql`EXCLUDED.cpu_freq_mhz`,
          flashKb: sql`EXCLUDED.flash_kb`,
          cores: sql`EXCLUDED.cores`,
          updatedAt: sql`NOW()`,
        },
      })
  }

  /**
   * Get all enabled sensor configurations grouped by module
   */
  async getEnabledSensorConfigs(): Promise<Record<string, ModuleConfig>> {
    const result = await this.db
      .select({
        moduleId: schema.sensorConfig.moduleId,
        sensorType: schema.sensorConfig.sensorType,
        intervalSeconds: schema.sensorConfig.intervalSeconds,
      })
      .from(schema.sensorConfig)
      .where(eq(schema.sensorConfig.enabled, true))

    // Group by module
    const configsByModule: Record<string, ModuleConfig> = {}
    for (const row of result) {
      if (!configsByModule[row.moduleId]) {
        configsByModule[row.moduleId] = { sensors: {} }
      }
      configsByModule[row.moduleId].sensors![row.sensorType] = {
        interval: row.intervalSeconds ?? undefined,
      }
    }

    return configsByModule
  }
}
