import { z } from 'zod'

// --- Shared ---
export const ModuleConfigSchema = z.object({
  sensors: z
    .record(
      z.string(),
      z.object({
        interval: z.number().optional(),
        model: z.string().optional(),
      })
    )
    .optional(),
})

export const ModuleParamsSchema = z.object({
  id: z.string(),
})

export const SensorResetSchema = z.object({
  sensor: z.enum([
    'co2', 'temp', 'temperature', 'humidity', 'voc', 'pressure', 'temperature_bmp',
    'pm1', 'pm25', 'pm4', 'pm10', 'eco2', 'tvoc', 'temp_sht', 'hum_sht', 'all'
  ]),
})

export const HardwareEnableSchema = z.object({
  hardware: z.enum([
    'dht22', 'bmp280', 'sgp40', 'sgp30', 'sps30', 'sht40', 'mhz14a', 'sc16co'
  ]),
  enabled: z.boolean(),
})


export const PreferencesSchema = z.record(z.any())

export const UpdatePreferencesResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  preferences: z.record(z.any()),
})

// --- Modules ---
export const ModuleListResponseSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    status: z.null(),
  })
)

// --- Module Data (status + time series) ---
export const ModuleDataQuerySchema = z.object({
  days: z.string().default('1').transform(Number),
  limit: z.string().default('10000').transform(Number),
})

const SensorDataPointSchema = z.object({
  time: z.date().or(z.string()),
  value: z.number(),
})

const SystemInfoSchema = z.object({
  ip: z.string().nullable(),
  mac: z.string().nullable(),
  bootedAt: z.string().nullable(),
  rssi: z.number().nullable(),
  flash: z.object({
    usedKb: z.number().nullable(),
    freeKb: z.number().nullable(),
    systemKb: z.number().nullable(),
  }),
  memory: z.object({
    heapTotalKb: z.number().nullable(),
    heapFreeKb: z.number().nullable(),
    heapMinFreeKb: z.number().nullable(),
  }),
})

const HardwareInfoSchema = z.object({
  chip: z.object({
    model: z.string().nullable(),
    rev: z.number().nullable(),
    cpuFreqMhz: z.number().nullable(),
    flashKb: z.number().nullable(),
    cores: z.number().nullable(),
  }),
})

const DeviceStatusSchema = z.object({
  system: SystemInfoSchema.optional(),
  hardware: HardwareInfoSchema.optional(),
  sensors: z
    .record(
      z.string(),
      z.object({
        status: z.string(),
        value: z.number().nullable(),
      })
    )
    .optional(),
  sensorsConfig: z
    .object({
      sensors: z.record(
        z.string(),
        z.object({
          interval: z.number().nullable(),
          model: z.string().nullable(),
        })
      ),
    })
    .optional(),
  preferences: z.record(z.any()).optional(),
  zoneName: z.string().nullable().optional(),
  moduleType: z.string().nullable().optional(),
})

export const ModuleDataResponseSchema = z.object({
  status: DeviceStatusSchema,
  sensors: z.object({
    co2: z.array(SensorDataPointSchema),
    temp: z.array(SensorDataPointSchema),
    hum: z.array(SensorDataPointSchema),
    voc: z.array(SensorDataPointSchema),
    pressure: z.array(SensorDataPointSchema),
    temperature_bmp: z.array(SensorDataPointSchema),
    pm1: z.array(SensorDataPointSchema),
    pm25: z.array(SensorDataPointSchema),
    pm4: z.array(SensorDataPointSchema),
    pm10: z.array(SensorDataPointSchema),
    eco2: z.array(SensorDataPointSchema),
    tvoc: z.array(SensorDataPointSchema),
    temp_sht: z.array(SensorDataPointSchema),
    hum_sht: z.array(SensorDataPointSchema),
  }),
})

// Separate status endpoint schema
export const ModuleStatusResponseSchema = DeviceStatusSchema

// Separate history endpoint schema
export const ModuleHistoryQuerySchema = z.object({
  days: z.string().default('1').transform(Number),
})

// Dynamic history schema - supports any sensor keys
export const ModuleHistoryResponseSchema = z.record(
  z.string(),
  z.array(SensorDataPointSchema)
)

export const ConfigUpdateResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
})

export const ModuleStorageResponseSchema = z.object({
  rowCount: z.number(),
  estimatedSizeBytes: z.number(),
  oldestMeasurement: z.string().nullable(),
  newestMeasurement: z.string().nullable(),
  activeSensors: z.array(z.object({
    sensorType: z.string(),
    intervalSeconds: z.number().nullable(),
    rowCount: z.number(),
  })),
})
