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
exports.MqttRepository = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const schema = __importStar(require("../../db/schema"));
class MqttRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    /**
     * Insert batch of measurements (optimized for TimescaleDB)
     */
    async insertMeasurementsBatch(measurements) {
        if (measurements.length === 0)
            return;
        try {
            // Use Drizzle batch insert for better performance
            // Note: onConflictDoUpdate() met à jour les doublons basés sur la clé primaire composite
            // (time, module_id, sensor_type, hardware_id)
            await this.db
                .insert(schema.measurements)
                .values(measurements.map(m => ({
                time: m.time,
                moduleId: m.moduleId,
                sensorType: m.sensorType,
                hardwareId: m.hardwareId,
                value: m.value,
            })))
                .onConflictDoUpdate({
                target: [
                    schema.measurements.time,
                    schema.measurements.moduleId,
                    schema.measurements.sensorType,
                    schema.measurements.hardwareId,
                ],
                set: {
                    value: (0, drizzle_orm_1.sql) `EXCLUDED.value`,
                },
            });
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            // Log les premières mesures pour debug
            const sample = measurements.slice(0, 2).map(m => ({
                time: m.time.toISOString(),
                moduleId: m.moduleId,
                sensorType: m.sensorType,
                hardwareId: m.hardwareId,
                value: m.value,
            }));
            throw new Error(`Failed to insert measurements batch: ${errorMessage}. Sample: ${JSON.stringify(sample)}`);
        }
    }
    /**
     * Update system status (real-time data: rssi, memory)
     */
    async updateSystemStatus(moduleId, data) {
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
                rssi: (0, drizzle_orm_1.sql) `EXCLUDED.rssi`,
                heapFreeKb: (0, drizzle_orm_1.sql) `COALESCE(EXCLUDED.heap_free_kb, device_system_status.heap_free_kb)`,
                heapMinFreeKb: (0, drizzle_orm_1.sql) `COALESCE(EXCLUDED.heap_min_free_kb, device_system_status.heap_min_free_kb)`,
                updatedAt: (0, drizzle_orm_1.sql) `NOW()`,
            },
        });
    }
    /**
     * Update system configuration (static data: ip, mac, flash, etc.)
     * Note: bootedAt is only set on first insert, never overwritten
     */
    async updateSystemConfig(moduleId, data) {
        // Calculate bootedAt from uptimeStart (absolute timestamp when ESP32 booted)
        const uptimeSeconds = typeof data.uptimeStart === 'string'
            ? parseInt(data.uptimeStart, 10)
            : (data.uptimeStart ?? null);
        const bootedAt = uptimeSeconds !== null
            ? new Date(Date.now() - uptimeSeconds * 1000)
            : null;
        await this.db
            .insert(schema.deviceSystemStatus)
            .values({
            moduleId,
            moduleType: data.moduleType ?? null,
            ip: data.ip ?? null,
            mac: data.mac ?? null,
            bootedAt: bootedAt,
            flashUsedKb: data.flash?.usedKb ?? null,
            flashFreeKb: data.flash?.freeKb ?? null,
            flashSystemKb: data.flash?.systemKb ?? null,
            heapTotalKb: data.memory?.heapTotalKb ?? null,
            updatedAt: new Date(),
        })
            .onConflictDoUpdate({
            target: schema.deviceSystemStatus.moduleId,
            set: {
                moduleType: (0, drizzle_orm_1.sql) `COALESCE(EXCLUDED.module_type, device_system_status.module_type)`,
                ip: (0, drizzle_orm_1.sql) `COALESCE(EXCLUDED.ip, device_system_status.ip)`,
                mac: (0, drizzle_orm_1.sql) `COALESCE(EXCLUDED.mac, device_system_status.mac)`,
                // bootedAt: always update (on reboot, uptimeStart resets so bootedAt updates correctly)
                bootedAt: (0, drizzle_orm_1.sql) `EXCLUDED.booted_at`,
                flashUsedKb: (0, drizzle_orm_1.sql) `COALESCE(EXCLUDED.flash_used_kb, device_system_status.flash_used_kb)`,
                flashFreeKb: (0, drizzle_orm_1.sql) `COALESCE(EXCLUDED.flash_free_kb, device_system_status.flash_free_kb)`,
                flashSystemKb: (0, drizzle_orm_1.sql) `COALESCE(EXCLUDED.flash_system_kb, device_system_status.flash_system_kb)`,
                heapTotalKb: (0, drizzle_orm_1.sql) `COALESCE(EXCLUDED.heap_total_kb, device_system_status.heap_total_kb)`,
                updatedAt: (0, drizzle_orm_1.sql) `NOW()`,
            },
        });
    }
    /**
     * Update sensor status (batch update for multiple sensors)
     */
    async updateSensorStatus(moduleId, data) {
        const updates = Object.entries(data).map(([sensorType, sensor]) => this.db
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
                status: (0, drizzle_orm_1.sql) `EXCLUDED.status`,
                value: (0, drizzle_orm_1.sql) `EXCLUDED.value`,
                updatedAt: (0, drizzle_orm_1.sql) `NOW()`,
            },
        }));
        await Promise.all(updates);
    }
    /**
     * Update sensor configuration (batch update for multiple sensors)
     */
    async updateSensorConfig(moduleId, data) {
        const updates = Object.entries(data).map(([sensorType, sensor]) => this.db
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
                intervalSeconds: (0, drizzle_orm_1.sql) `COALESCE(EXCLUDED.interval_seconds, sensor_config.interval_seconds)`,
                model: (0, drizzle_orm_1.sql) `COALESCE(EXCLUDED.model, sensor_config.model)`,
                updatedAt: (0, drizzle_orm_1.sql) `NOW()`,
            },
        }));
        await Promise.all(updates);
    }
    /**
     * Update hardware information
     */
    async updateHardware(moduleId, data) {
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
                chipModel: (0, drizzle_orm_1.sql) `EXCLUDED.chip_model`,
                chipRev: (0, drizzle_orm_1.sql) `EXCLUDED.chip_rev`,
                cpuFreqMhz: (0, drizzle_orm_1.sql) `EXCLUDED.cpu_freq_mhz`,
                flashKb: (0, drizzle_orm_1.sql) `EXCLUDED.flash_kb`,
                cores: (0, drizzle_orm_1.sql) `EXCLUDED.cores`,
                updatedAt: (0, drizzle_orm_1.sql) `NOW()`,
            },
        });
    }
    /**
     * Get all enabled sensor configurations grouped by module
     */
    async getEnabledSensorConfigs() {
        const result = await this.db
            .select({
            moduleId: schema.sensorConfig.moduleId,
            sensorType: schema.sensorConfig.sensorType,
            intervalSeconds: schema.sensorConfig.intervalSeconds,
        })
            .from(schema.sensorConfig)
            .where((0, drizzle_orm_1.eq)(schema.sensorConfig.enabled, true));
        // Group by module
        const configsByModule = {};
        for (const row of result) {
            if (!configsByModule[row.moduleId]) {
                configsByModule[row.moduleId] = { sensors: {} };
            }
            configsByModule[row.moduleId].sensors[row.sensorType] = {
                interval: row.intervalSeconds ?? undefined,
            };
        }
        return configsByModule;
    }
}
exports.MqttRepository = MqttRepository;
