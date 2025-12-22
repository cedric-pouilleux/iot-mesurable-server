-- Script pour TOUT supprimer et TOUT recréer
-- ⚠️ ATTENTION: Ce script supprime TOUTES les données !

-- 1. Supprimer toutes les tables existantes
DROP TABLE IF EXISTS "measurements" CASCADE;
DROP TABLE IF EXISTS "measurements_hourly" CASCADE;
DROP TABLE IF EXISTS "sensor_status" CASCADE;
DROP TABLE IF EXISTS "sensor_config" CASCADE;
DROP TABLE IF EXISTS "device_hardware" CASCADE;
DROP TABLE IF EXISTS "device_system_status" CASCADE;

-- 2. Supprimer les vues matérialisées TimescaleDB si elles existent
DROP MATERIALIZED VIEW IF EXISTS "measurements_hourly" CASCADE;

-- 3. Recréer toutes les tables

-- Table: device_system_status
CREATE TABLE "device_system_status" (
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
CREATE TABLE "device_hardware" (
	"module_id" text PRIMARY KEY NOT NULL,
	"chip_model" text,
	"chip_rev" integer,
	"cpu_freq_mhz" integer,
	"flash_kb" integer,
	"cores" integer,
	"updated_at" timestamp DEFAULT now()
);

-- Table: sensor_status
CREATE TABLE "sensor_status" (
	"module_id" text NOT NULL,
	"sensor_type" text NOT NULL,
	"status" text,
	"value" double precision,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "sensor_status_module_id_sensor_type_pk" PRIMARY KEY("module_id","sensor_type")
);

-- Table: sensor_config
CREATE TABLE "sensor_config" (
	"module_id" text NOT NULL,
	"sensor_type" text NOT NULL,
	"interval_seconds" integer,
	"model" text,
	"enabled" boolean DEFAULT true,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "sensor_config_module_id_sensor_type_pk" PRIMARY KEY("module_id","sensor_type")
);

-- Table: measurements
CREATE TABLE "measurements" (
	"time" timestamptz NOT NULL,
	"module_id" text NOT NULL,
	"sensor_type" text NOT NULL,
	"value" double precision NOT NULL,
	CONSTRAINT "measurements_time_module_id_sensor_type_pk" PRIMARY KEY("time","module_id","sensor_type")
);

-- 4. Convertir measurements en hypertable TimescaleDB
SELECT create_hypertable('measurements', 'time', if_not_exists => true);

-- 5. Vérification
SELECT '✅ Toutes les tables ont été créées avec succès!' as status;
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

