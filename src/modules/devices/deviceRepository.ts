import { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { eq, sql } from 'drizzle-orm'
import * as schema from '../../db/schema'

export class DeviceRepository {
  constructor(private db: NodePgDatabase<typeof schema>) {}

  async getAllModules() {
    return this.db
      .selectDistinct({ moduleId: schema.deviceSystemStatus.moduleId })
      .from(schema.deviceSystemStatus)
      .orderBy(schema.deviceSystemStatus.moduleId)
  }

  async getDeviceStatus(moduleId: string) {
    const result = await this.db
      .select({
        moduleId: schema.deviceSystemStatus.moduleId,
        moduleType: schema.deviceSystemStatus.moduleType,
        ip: schema.deviceSystemStatus.ip,
        mac: schema.deviceSystemStatus.mac,
        bootedAt: schema.deviceSystemStatus.bootedAt,
        rssi: schema.deviceSystemStatus.rssi,
        flashUsedKb: schema.deviceSystemStatus.flashUsedKb,
        flashFreeKb: schema.deviceSystemStatus.flashFreeKb,
        flashSystemKb: schema.deviceSystemStatus.flashSystemKb,
        heapTotalKb: schema.deviceSystemStatus.heapTotalKb,
        heapFreeKb: schema.deviceSystemStatus.heapFreeKb,
        heapMinFreeKb: schema.deviceSystemStatus.heapMinFreeKb,
        chipModel: schema.deviceHardware.chipModel,
        chipRev: schema.deviceHardware.chipRev,
        cpuFreqMhz: schema.deviceHardware.cpuFreqMhz,
        flashKb: schema.deviceHardware.flashKb,
        cores: schema.deviceHardware.cores,
        preferences: schema.deviceSystemStatus.preferences,
        zoneId: schema.deviceSystemStatus.zoneId,
        zoneName: schema.zones.name,
      })
      .from(schema.deviceSystemStatus)
      .leftJoin(
        schema.deviceHardware,
        eq(schema.deviceSystemStatus.moduleId, schema.deviceHardware.moduleId)
      )
      .leftJoin(
        schema.zones,
        eq(schema.deviceSystemStatus.zoneId, schema.zones.id)
      )
      .where(eq(schema.deviceSystemStatus.moduleId, moduleId))

    return result[0] || null
  }

  async getSensorStatus(moduleId: string) {
    return this.db
      .select()
      .from(schema.sensorStatus)
      .where(eq(schema.sensorStatus.moduleId, moduleId))
  }

  async getSensorConfig(moduleId: string) {
    return this.db
      .select()
      .from(schema.sensorConfig)
      .where(eq(schema.sensorConfig.moduleId, moduleId))
  }

  async getHistoryData(moduleId: string, days: number) {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    // Déterminer le niveau d'agrégation selon la période
    const aggregation = days >= 7 ? '1 hour' : days > 1 ? '1 minute' : null

    let query
    if (aggregation) {
      query = sql`
        SELECT time_bucket(${aggregation}, time) as time, sensor_type as "sensorType", hardware_id as "hardwareId", AVG(value) as value
        FROM measurements
        WHERE module_id = ${moduleId} AND time > ${cutoffDate}
        GROUP BY 1, sensor_type, hardware_id
        ORDER BY time DESC
      `
    } else {
      query = sql`
        SELECT time, sensor_type as "sensorType", hardware_id as "hardwareId", value
        FROM measurements
        WHERE module_id = ${moduleId} AND time > ${cutoffDate}
        ORDER BY time DESC
      `
    }

    const result = await this.db.execute(query)
    return result.rows.map(row => ({
      time: new Date(row.time as string | Date),
      sensorType: row.sensorType as string,
      hardwareId: row.hardwareId as string,
      value: Number(row.value),
    }))
  }

  async updateSensorConfig(moduleId: string, sensorType: string, interval: number) {
    return this.db
      .insert(schema.sensorConfig)
      .values({
        moduleId,
        sensorType,
        intervalSeconds: interval,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [schema.sensorConfig.moduleId, schema.sensorConfig.sensorType],
        set: {
          intervalSeconds: interval,
          updatedAt: new Date(),
        },
      })
  }

  async updatePreferences(moduleId: string, preferences: Record<string, any>) {
    // Merge new preferences with existing ones using jsonb_concat or simple update if fetching first
    // Since we're using Drizzle, we can fetch, merge, and update, or use SQL for atomic merge.
    // Simple approach: atomic merge using || operator for jsonb in Postgres
    
    return this.db
      .update(schema.deviceSystemStatus)
      .set({
        preferences: sql`COALESCE(preferences, '{}'::jsonb) || ${JSON.stringify(preferences)}::jsonb`,
        updatedAt: new Date(),
      })
      .where(eq(schema.deviceSystemStatus.moduleId, moduleId))
  }

  async removeFromZone(moduleId: string) {
    return this.db
      .update(schema.deviceSystemStatus)
      .set({
        zoneId: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.deviceSystemStatus.moduleId, moduleId))
  }
  async getModuleStorageStats(moduleId: string) {
    const result = await this.db.execute<{
      row_count: string
      oldest_measurement: string
      newest_measurement: string
    }>(sql`
      SELECT 
        COUNT(*) as row_count,
        MIN(time) as oldest_measurement,
        MAX(time) as newest_measurement
      FROM measurements
      WHERE module_id = ${moduleId}
    `)

    return result.rows[0]
  }

  /**
   * Delete a module and all its related data
   */
  async deleteModule(moduleId: string): Promise<{ deletedTables: string[] }> {
    const deletedTables: string[] = []

    // Delete measurements first (largest table)
    await this.db.delete(schema.measurements).where(eq(schema.measurements.moduleId, moduleId))
    deletedTables.push('measurements')

    // Delete sensor status
    await this.db.delete(schema.sensorStatus).where(eq(schema.sensorStatus.moduleId, moduleId))
    deletedTables.push('sensor_status')

    // Delete sensor config
    await this.db.delete(schema.sensorConfig).where(eq(schema.sensorConfig.moduleId, moduleId))
    deletedTables.push('sensor_config')

    // Delete device hardware
    await this.db.delete(schema.deviceHardware).where(eq(schema.deviceHardware.moduleId, moduleId))
    deletedTables.push('device_hardware')

    // Delete device system status (main record)
    await this.db.delete(schema.deviceSystemStatus).where(eq(schema.deviceSystemStatus.moduleId, moduleId))
    deletedTables.push('device_system_status')

    return { deletedTables }
  }
}
