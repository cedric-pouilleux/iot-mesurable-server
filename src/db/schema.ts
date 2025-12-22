import {
  pgTable,
  text,
  integer,
  doublePrecision,
  timestamp,
  boolean,
  primaryKey,
  index,
  jsonb,
  uuid,
} from 'drizzle-orm/pg-core'
import crypto from 'node:crypto'

// --- Zones ---

export const zones = pgTable('zones', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
})

// --- Devices & Status ---

export const deviceSystemStatus = pgTable('device_system_status', {
  moduleId: text('module_id').primaryKey(),
  name: text('name'),                                    // Nom affiché (défini par user)
  moduleType: text('module_type'),                       // "air-quality", "lighting", etc.
  zoneId: uuid('zone_id').references(() => zones.id),    // Zone assignée (nullable)
  ip: text('ip'),
  mac: text('mac'),
  uptimeStart: integer('uptime_start'),
  bootedAt: timestamp('booted_at', { withTimezone: true }),
  rssi: integer('rssi'),
  flashUsedKb: integer('flash_used_kb'),
  flashFreeKb: integer('flash_free_kb'),
  flashSystemKb: integer('flash_system_kb'),
  heapTotalKb: integer('heap_total_kb'),
  heapFreeKb: integer('heap_free_kb'),
  heapMinFreeKb: integer('heap_min_free_kb'),
  updatedAt: timestamp('updated_at').defaultNow(),
  preferences: jsonb('preferences'),
})

export const deviceHardware = pgTable('device_hardware', {
  moduleId: text('module_id').primaryKey(),
  chipModel: text('chip_model'),
  chipRev: integer('chip_rev'),
  cpuFreqMhz: integer('cpu_freq_mhz'),
  flashKb: integer('flash_kb'),
  cores: integer('cores'),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// --- Sensors ---

export const sensorStatus = pgTable(
  'sensor_status',
  {
    moduleId: text('module_id').notNull(),
    sensorType: text('sensor_type').notNull(),
    status: text('status'),
    value: doublePrecision('value'),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  table => {
    return {
      pk: primaryKey({ columns: [table.moduleId, table.sensorType] }),
    }
  }
)

export const sensorConfig = pgTable(
  'sensor_config',
  {
    moduleId: text('module_id').notNull(),
    sensorType: text('sensor_type').notNull(),
    intervalSeconds: integer('interval_seconds'),
    model: text('model'),
    enabled: boolean('enabled').default(true),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  table => {
    return {
      pk: primaryKey({ columns: [table.moduleId, table.sensorType] }),
    }
  }
)

// --- Measurements (TimescaleDB) ---

export const measurements = pgTable(
  'measurements',
  {
    time: timestamp('time', { withTimezone: true }).notNull(),
    moduleId: text('module_id').notNull(),
    sensorType: text('sensor_type').notNull(),    // Canonical: temperature, humidity, co2, etc.
    hardwareId: text('hardware_id').notNull(),    // Source hardware: dht22, bmp280, sht40, etc.
    value: doublePrecision('value').notNull(),
  },
  table => {
    return {
      pk: primaryKey({ columns: [table.time, table.moduleId, table.sensorType, table.hardwareId] }),
      moduleIdTimeIdx: index('measurements_module_id_time_idx').on(table.moduleId, table.time),
    }
  }
)

// Continuous Aggregate View (Read-only mostly)
export const measurementsHourly = pgTable('measurements_hourly', {
  bucket: timestamp('bucket').notNull(),
  moduleId: text('module_id').notNull(),
  sensorType: text('sensor_type').notNull(),
  avgValue: doublePrecision('avg_value'),
  minValue: doublePrecision('min_value'),
  maxValue: doublePrecision('max_value'),
  count: integer('count'),
})

// --- Logs ---

export const systemLogs = pgTable('system_logs', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  category: text('category').notNull(), // HARDWARE, MQTT, DB, API, SYSTEM
  source: text('source').notNull().default('SYSTEM'), // SYSTEM or USER
  direction: text('direction'), // IN, OUT, or null
  level: text('level').notNull(),
  msg: text('msg').notNull(),
  time: timestamp('time').notNull(),
  details: jsonb('details'),
})
