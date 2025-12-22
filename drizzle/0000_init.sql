-- Migration initiale : Création de toutes les tables
-- Note: Ce fichier est conservé pour référence. Pour réinitialiser la base, utilisez `npm run db:reset`

-- Table: device_system_status
CREATE TABLE IF NOT EXISTS "device_system_status" (
	"module_id" text PRIMARY KEY NOT NULL,
	"ip" text,
	"mac" text,
	"uptime_start" integer,
	"rssi" integer,
	"flash_used_kb" integer,
	"flash_free_kb" integer,
	"flash_system_kb" integer,
	"heap_total_kb" integer,
	"heap_free_kb" integer,
	"heap_min_free_kb" integer,
	"updated_at" timestamp DEFAULT now()
);

-- Table: device_hardware
CREATE TABLE IF NOT EXISTS "device_hardware" (
	"module_id" text PRIMARY KEY NOT NULL,
	"chip_model" text,
	"chip_rev" integer,
	"cpu_freq_mhz" integer,
	"flash_kb" integer,
	"cores" integer,
	"updated_at" timestamp DEFAULT now()
);

-- Table: sensor_status
CREATE TABLE IF NOT EXISTS "sensor_status" (
	"module_id" text NOT NULL,
	"sensor_type" text NOT NULL,
	"status" text,
	"value" double precision,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "sensor_status_module_id_sensor_type_pk" PRIMARY KEY("module_id","sensor_type")
);

-- Table: sensor_config
CREATE TABLE IF NOT EXISTS "sensor_config" (
	"module_id" text NOT NULL,
	"sensor_type" text NOT NULL,
	"interval_seconds" integer,
	"model" text,
	"enabled" boolean DEFAULT true,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "sensor_config_module_id_sensor_type_pk" PRIMARY KEY("module_id","sensor_type")
);

-- Table: measurements (sera convertie en hypertable TimescaleDB après)
CREATE TABLE IF NOT EXISTS "measurements" (
	"time" timestamptz NOT NULL,
	"module_id" text NOT NULL,
	"sensor_type" text NOT NULL,
	"value" double precision NOT NULL,
	CONSTRAINT "measurements_time_module_id_sensor_type_pk" PRIMARY KEY("time","module_id","sensor_type")
);

-- Table: measurements_hourly (vue matérialisée - sera créée via TimescaleDB Continuous Aggregate)
CREATE TABLE IF NOT EXISTS "measurements_hourly" (
	"bucket" timestamp NOT NULL,
	"module_id" text NOT NULL,
	"sensor_type" text NOT NULL,
	"avg_value" double precision,
	"min_value" double precision,
	"max_value" double precision,
	"count" integer
);

