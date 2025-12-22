"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceRepository = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const schema = __importStar(require("../../db/schema"));
class DeviceRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async getAllModules() {
        return this.db
            .selectDistinct({ moduleId: schema.deviceSystemStatus.moduleId })
            .from(schema.deviceSystemStatus)
            .orderBy(schema.deviceSystemStatus.moduleId);
    }
    async getDeviceStatus(moduleId) {
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
            .leftJoin(schema.deviceHardware, (0, drizzle_orm_1.eq)(schema.deviceSystemStatus.moduleId, schema.deviceHardware.moduleId))
            .leftJoin(schema.zones, (0, drizzle_orm_1.eq)(schema.deviceSystemStatus.zoneId, schema.zones.id))
            .where((0, drizzle_orm_1.eq)(schema.deviceSystemStatus.moduleId, moduleId));
        return result[0] || null;
    }
    async getSensorStatus(moduleId) {
        return this.db
            .select()
            .from(schema.sensorStatus)
            .where((0, drizzle_orm_1.eq)(schema.sensorStatus.moduleId, moduleId));
    }
    async getSensorConfig(moduleId) {
        return this.db
            .select()
            .from(schema.sensorConfig)
            .where((0, drizzle_orm_1.eq)(schema.sensorConfig.moduleId, moduleId));
    }
    async getHistoryData(moduleId, days) {
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        // Déterminer le niveau d'agrégation selon la période
        const aggregation = days >= 7 ? '1 hour' : days > 1 ? '1 minute' : null;
        let query;
        if (aggregation) {
            query = (0, drizzle_orm_1.sql) `
        SELECT time_bucket(${aggregation}, time) as time, sensor_type as "sensorType", hardware_id as "hardwareId", AVG(value) as value
        FROM measurements
        WHERE module_id = ${moduleId} AND time > ${cutoffDate}
        GROUP BY 1, sensor_type, hardware_id
        ORDER BY time DESC
      `;
        }
        else {
            query = (0, drizzle_orm_1.sql) `
        SELECT time, sensor_type as "sensorType", hardware_id as "hardwareId", value
        FROM measurements
        WHERE module_id = ${moduleId} AND time > ${cutoffDate}
        ORDER BY time DESC
      `;
        }
        const result = await this.db.execute(query);
        return result.rows.map(row => ({
            time: new Date(row.time),
            sensorType: row.sensorType,
            hardwareId: row.hardwareId,
            value: Number(row.value),
        }));
    }
    async updateSensorConfig(moduleId, sensorType, interval) {
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
        });
    }
    async updatePreferences(moduleId, preferences) {
        // Merge new preferences with existing ones using jsonb_concat or simple update if fetching first
        // Since we're using Drizzle, we can fetch, merge, and update, or use SQL for atomic merge.
        // Simple approach: atomic merge using || operator for jsonb in Postgres
        return this.db
            .update(schema.deviceSystemStatus)
            .set({
            preferences: (0, drizzle_orm_1.sql) `COALESCE(preferences, '{}'::jsonb) || ${JSON.stringify(preferences)}::jsonb`,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema.deviceSystemStatus.moduleId, moduleId));
    }
    async removeFromZone(moduleId) {
        return this.db
            .update(schema.deviceSystemStatus)
            .set({
            zoneId: null,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema.deviceSystemStatus.moduleId, moduleId));
    }
    async getModuleStorageStats(moduleId) {
        const result = await this.db.execute((0, drizzle_orm_1.sql) `
      SELECT 
        COUNT(*) as row_count,
        MIN(time) as oldest_measurement,
        MAX(time) as newest_measurement
      FROM measurements
      WHERE module_id = ${moduleId}
    `);
        return result.rows[0];
    }
}
exports.DeviceRepository = DeviceRepository;
