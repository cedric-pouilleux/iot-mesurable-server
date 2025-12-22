"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModuleStorageResponseSchema = exports.ConfigUpdateResponseSchema = exports.ModuleHistoryResponseSchema = exports.ModuleHistoryQuerySchema = exports.ModuleStatusResponseSchema = exports.ModuleDataResponseSchema = exports.ModuleDataQuerySchema = exports.ModuleListResponseSchema = exports.UpdatePreferencesResponseSchema = exports.PreferencesSchema = exports.SensorResetSchema = exports.ModuleParamsSchema = exports.ModuleConfigSchema = void 0;
const zod_1 = require("zod");
// --- Shared ---
exports.ModuleConfigSchema = zod_1.z.object({
    sensors: zod_1.z
        .record(zod_1.z.string(), zod_1.z.object({
        interval: zod_1.z.number().optional(),
        model: zod_1.z.string().optional(),
    }))
        .optional(),
});
exports.ModuleParamsSchema = zod_1.z.object({
    id: zod_1.z.string(),
});
exports.SensorResetSchema = zod_1.z.object({
    sensor: zod_1.z.enum([
        'co2', 'temp', 'temperature', 'humidity', 'voc', 'pressure', 'temperature_bmp',
        'pm1', 'pm25', 'pm4', 'pm10', 'eco2', 'tvoc', 'temp_sht', 'hum_sht', 'all'
    ]),
});
exports.PreferencesSchema = zod_1.z.record(zod_1.z.any());
exports.UpdatePreferencesResponseSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    message: zod_1.z.string(),
    preferences: zod_1.z.record(zod_1.z.any()),
});
// --- Modules ---
exports.ModuleListResponseSchema = zod_1.z.array(zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    type: zod_1.z.string(),
    status: zod_1.z.null(),
}));
// --- Module Data (status + time series) ---
exports.ModuleDataQuerySchema = zod_1.z.object({
    days: zod_1.z.string().default('1').transform(Number),
    limit: zod_1.z.string().default('10000').transform(Number),
});
const SensorDataPointSchema = zod_1.z.object({
    time: zod_1.z.date().or(zod_1.z.string()),
    value: zod_1.z.number(),
});
const SystemInfoSchema = zod_1.z.object({
    ip: zod_1.z.string().nullable(),
    mac: zod_1.z.string().nullable(),
    bootedAt: zod_1.z.string().nullable(),
    rssi: zod_1.z.number().nullable(),
    flash: zod_1.z.object({
        usedKb: zod_1.z.number().nullable(),
        freeKb: zod_1.z.number().nullable(),
        systemKb: zod_1.z.number().nullable(),
    }),
    memory: zod_1.z.object({
        heapTotalKb: zod_1.z.number().nullable(),
        heapFreeKb: zod_1.z.number().nullable(),
        heapMinFreeKb: zod_1.z.number().nullable(),
    }),
});
const HardwareInfoSchema = zod_1.z.object({
    chip: zod_1.z.object({
        model: zod_1.z.string().nullable(),
        rev: zod_1.z.number().nullable(),
        cpuFreqMhz: zod_1.z.number().nullable(),
        flashKb: zod_1.z.number().nullable(),
        cores: zod_1.z.number().nullable(),
    }),
});
const DeviceStatusSchema = zod_1.z.object({
    system: SystemInfoSchema.optional(),
    hardware: HardwareInfoSchema.optional(),
    sensors: zod_1.z
        .record(zod_1.z.string(), zod_1.z.object({
        status: zod_1.z.string(),
        value: zod_1.z.number().nullable(),
    }))
        .optional(),
    sensorsConfig: zod_1.z
        .object({
        sensors: zod_1.z.record(zod_1.z.string(), zod_1.z.object({
            interval: zod_1.z.number().nullable(),
            model: zod_1.z.string().nullable(),
        })),
    })
        .optional(),
    preferences: zod_1.z.record(zod_1.z.any()).optional(),
    zoneName: zod_1.z.string().nullable().optional(),
    moduleType: zod_1.z.string().nullable().optional(),
});
exports.ModuleDataResponseSchema = zod_1.z.object({
    status: DeviceStatusSchema,
    sensors: zod_1.z.object({
        co2: zod_1.z.array(SensorDataPointSchema),
        temp: zod_1.z.array(SensorDataPointSchema),
        hum: zod_1.z.array(SensorDataPointSchema),
        voc: zod_1.z.array(SensorDataPointSchema),
        pressure: zod_1.z.array(SensorDataPointSchema),
        temperature_bmp: zod_1.z.array(SensorDataPointSchema),
        pm1: zod_1.z.array(SensorDataPointSchema),
        pm25: zod_1.z.array(SensorDataPointSchema),
        pm4: zod_1.z.array(SensorDataPointSchema),
        pm10: zod_1.z.array(SensorDataPointSchema),
        eco2: zod_1.z.array(SensorDataPointSchema),
        tvoc: zod_1.z.array(SensorDataPointSchema),
        temp_sht: zod_1.z.array(SensorDataPointSchema),
        hum_sht: zod_1.z.array(SensorDataPointSchema),
    }),
});
// Separate status endpoint schema
exports.ModuleStatusResponseSchema = DeviceStatusSchema;
// Separate history endpoint schema
exports.ModuleHistoryQuerySchema = zod_1.z.object({
    days: zod_1.z.string().default('1').transform(Number),
});
// Dynamic history schema - supports any sensor keys
exports.ModuleHistoryResponseSchema = zod_1.z.record(zod_1.z.string(), zod_1.z.array(SensorDataPointSchema));
exports.ConfigUpdateResponseSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    message: zod_1.z.string(),
});
exports.ModuleStorageResponseSchema = zod_1.z.object({
    rowCount: zod_1.z.number(),
    estimatedSizeBytes: zod_1.z.number(),
    oldestMeasurement: zod_1.z.string().nullable(),
    newestMeasurement: zod_1.z.string().nullable(),
    activeSensors: zod_1.z.array(zod_1.z.object({
        sensorType: zod_1.z.string(),
        intervalSeconds: zod_1.z.number().nullable(),
        rowCount: zod_1.z.number(),
    })),
});
