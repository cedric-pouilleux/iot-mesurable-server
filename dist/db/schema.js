"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.systemLogs = exports.measurementsHourly = exports.measurements = exports.sensorConfig = exports.sensorStatus = exports.deviceHardware = exports.deviceSystemStatus = exports.zones = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const node_crypto_1 = __importDefault(require("node:crypto"));
// --- Zones ---
exports.zones = (0, pg_core_1.pgTable)('zones', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    name: (0, pg_core_1.text)('name').notNull(),
    description: (0, pg_core_1.text)('description'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
});
// --- Devices & Status ---
exports.deviceSystemStatus = (0, pg_core_1.pgTable)('device_system_status', {
    moduleId: (0, pg_core_1.text)('module_id').primaryKey(),
    name: (0, pg_core_1.text)('name'), // Nom affiché (défini par user)
    moduleType: (0, pg_core_1.text)('module_type'), // "air-quality", "lighting", etc.
    zoneId: (0, pg_core_1.uuid)('zone_id').references(() => exports.zones.id), // Zone assignée (nullable)
    ip: (0, pg_core_1.text)('ip'),
    mac: (0, pg_core_1.text)('mac'),
    uptimeStart: (0, pg_core_1.integer)('uptime_start'),
    bootedAt: (0, pg_core_1.timestamp)('booted_at', { withTimezone: true }),
    rssi: (0, pg_core_1.integer)('rssi'),
    flashUsedKb: (0, pg_core_1.integer)('flash_used_kb'),
    flashFreeKb: (0, pg_core_1.integer)('flash_free_kb'),
    flashSystemKb: (0, pg_core_1.integer)('flash_system_kb'),
    heapTotalKb: (0, pg_core_1.integer)('heap_total_kb'),
    heapFreeKb: (0, pg_core_1.integer)('heap_free_kb'),
    heapMinFreeKb: (0, pg_core_1.integer)('heap_min_free_kb'),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
    preferences: (0, pg_core_1.jsonb)('preferences'),
});
exports.deviceHardware = (0, pg_core_1.pgTable)('device_hardware', {
    moduleId: (0, pg_core_1.text)('module_id').primaryKey(),
    chipModel: (0, pg_core_1.text)('chip_model'),
    chipRev: (0, pg_core_1.integer)('chip_rev'),
    cpuFreqMhz: (0, pg_core_1.integer)('cpu_freq_mhz'),
    flashKb: (0, pg_core_1.integer)('flash_kb'),
    cores: (0, pg_core_1.integer)('cores'),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
});
// --- Sensors ---
exports.sensorStatus = (0, pg_core_1.pgTable)('sensor_status', {
    moduleId: (0, pg_core_1.text)('module_id').notNull(),
    sensorType: (0, pg_core_1.text)('sensor_type').notNull(),
    status: (0, pg_core_1.text)('status'),
    value: (0, pg_core_1.doublePrecision)('value'),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
}, table => {
    return {
        pk: (0, pg_core_1.primaryKey)({ columns: [table.moduleId, table.sensorType] }),
    };
});
exports.sensorConfig = (0, pg_core_1.pgTable)('sensor_config', {
    moduleId: (0, pg_core_1.text)('module_id').notNull(),
    sensorType: (0, pg_core_1.text)('sensor_type').notNull(),
    intervalSeconds: (0, pg_core_1.integer)('interval_seconds'),
    model: (0, pg_core_1.text)('model'),
    enabled: (0, pg_core_1.boolean)('enabled').default(true),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
}, table => {
    return {
        pk: (0, pg_core_1.primaryKey)({ columns: [table.moduleId, table.sensorType] }),
    };
});
// --- Measurements (TimescaleDB) ---
exports.measurements = (0, pg_core_1.pgTable)('measurements', {
    time: (0, pg_core_1.timestamp)('time', { withTimezone: true }).notNull(),
    moduleId: (0, pg_core_1.text)('module_id').notNull(),
    sensorType: (0, pg_core_1.text)('sensor_type').notNull(), // Canonical: temperature, humidity, co2, etc.
    hardwareId: (0, pg_core_1.text)('hardware_id').notNull(), // Source hardware: dht22, bmp280, sht40, etc.
    value: (0, pg_core_1.doublePrecision)('value').notNull(),
}, table => {
    return {
        pk: (0, pg_core_1.primaryKey)({ columns: [table.time, table.moduleId, table.sensorType, table.hardwareId] }),
        moduleIdTimeIdx: (0, pg_core_1.index)('measurements_module_id_time_idx').on(table.moduleId, table.time),
    };
});
// Continuous Aggregate View (Read-only mostly)
exports.measurementsHourly = (0, pg_core_1.pgTable)('measurements_hourly', {
    bucket: (0, pg_core_1.timestamp)('bucket').notNull(),
    moduleId: (0, pg_core_1.text)('module_id').notNull(),
    sensorType: (0, pg_core_1.text)('sensor_type').notNull(),
    avgValue: (0, pg_core_1.doublePrecision)('avg_value'),
    minValue: (0, pg_core_1.doublePrecision)('min_value'),
    maxValue: (0, pg_core_1.doublePrecision)('max_value'),
    count: (0, pg_core_1.integer)('count'),
});
// --- Logs ---
exports.systemLogs = (0, pg_core_1.pgTable)('system_logs', {
    id: (0, pg_core_1.text)('id')
        .primaryKey()
        .$defaultFn(() => node_crypto_1.default.randomUUID()),
    category: (0, pg_core_1.text)('category').notNull(), // HARDWARE, MQTT, DB, API, SYSTEM
    source: (0, pg_core_1.text)('source').notNull().default('SYSTEM'), // SYSTEM or USER
    direction: (0, pg_core_1.text)('direction'), // IN, OUT, or null
    level: (0, pg_core_1.text)('level').notNull(),
    msg: (0, pg_core_1.text)('msg').notNull(),
    time: (0, pg_core_1.timestamp)('time').notNull(),
    details: (0, pg_core_1.jsonb)('details'),
});
