-- Script pour TOUT supprimer et TOUT recréer
-- ⚠️ ATTENTION: Ce script supprime TOUTES les données !
-- 🔄 Version synchronisée avec schéma Drizzle (schema.ts)

-- 1. Supprimer toutes les tables existantes
DROP TABLE IF EXISTS "measurements" CASCADE;
DROP TABLE IF EXISTS "measurements_hourly" CASCADE;
DROP TABLE IF EXISTS "sensor_status" CASCADE;
DROP TABLE IF EXISTS "sensor_config" CASCADE;
DROP TABLE IF EXISTS "device_hardware" CASCADE;
DROP TABLE IF EXISTS "device_system_status" CASCADE;
DROP TABLE IF EXISTS "zones" CASCADE;
DROP TABLE IF EXISTS "system_logs" CASCADE;

-- 2. Supprimer les vues matérialisées TimescaleDB si elles existent
DROP MATERIALIZED VIEW IF EXISTS "measurements_hourly" CASCADE;

-- 3. Recréer toutes les tables (synchronisé avec schema.ts)

-- Table: zones
CREATE TABLE "zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now()
);

-- Table: device_system_status (composite PK: module_id + chip_id)
CREATE TABLE "device_system_status" (
	"module_id" text NOT NULL,
	"chip_id" text NOT NULL,
	"name" text,
	"module_type" text,
	"zone_id" uuid REFERENCES "zones"("id"),
	"ip" text,
	"mac" text,
	"uptime_start" integer,
	"booted_at" timestamptz,
	"rssi" integer,
	"flash_used_kb" integer,
	"flash_free_kb" integer,
	"flash_system_kb" integer,
	"heap_total_kb" integer,
	"heap_free_kb" integer,
	"heap_min_free_kb" integer,
	"updated_at" timestamp DEFAULT now(),
	"preferences" jsonb,
	CONSTRAINT "device_system_status_module_id_chip_id_pk" PRIMARY KEY("module_id", "chip_id")
);

-- Table: device_hardware (composite PK: module_id + chip_id)
CREATE TABLE "device_hardware" (
	"module_id" text NOT NULL,
	"chip_id" text NOT NULL,
	"chip_model" text,
	"chip_rev" integer,
	"cpu_freq_mhz" integer,
	"flash_kb" integer,
	"cores" integer,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "device_hardware_module_id_chip_id_pk" PRIMARY KEY("module_id", "chip_id")
);

-- Table: sensor_status (composite PK: module_id + chip_id + sensor_type)
CREATE TABLE "sensor_status" (
	"module_id" text NOT NULL,
	"chip_id" text NOT NULL,
	"sensor_type" text NOT NULL,
	"status" text,
	"value" double precision,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "sensor_status_module_id_chip_id_sensor_type_pk" PRIMARY KEY("module_id", "chip_id", "sensor_type")
);

-- Table: sensor_config (composite PK: module_id + chip_id + sensor_type)
CREATE TABLE "sensor_config" (
	"module_id" text NOT NULL,
	"chip_id" text NOT NULL,
	"sensor_type" text NOT NULL,
	"interval_seconds" integer,
	"model" text,
	"enabled" boolean DEFAULT true,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "sensor_config_module_id_chip_id_sensor_type_pk" PRIMARY KEY("module_id", "chip_id", "sensor_type")
);

-- Table: measurements (TimescaleDB hypertable, composite PK)
CREATE TABLE "measurements" (
	"time" timestamptz NOT NULL,
	"module_id" text NOT NULL,
	"chip_id" text NOT NULL,
	"sensor_type" text NOT NULL,
	"hardware_id" text NOT NULL,
	"value" double precision NOT NULL,
	CONSTRAINT "measurements_time_module_id_chip_id_sensor_type_hardware_id_pk" PRIMARY KEY("time", "module_id", "chip_id", "sensor_type", "hardware_id")
);

-- Index pour optimiser les requêtes par module et temps
CREATE INDEX "measurements_module_id_chip_id_time_idx" ON "measurements" ("module_id", "chip_id", "time");

-- Table: measurements_hourly (pour agrégations)
CREATE TABLE "measurements_hourly" (
	"bucket" timestamp NOT NULL,
	"module_id" text NOT NULL,
	"chip_id" text NOT NULL,
	"sensor_type" text NOT NULL,
	"avg_value" double precision,
	"min_value" double precision,
	"max_value" double precision,
	"count" integer
);

-- Table: system_logs
CREATE TABLE "system_logs" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
	"category" text NOT NULL,
	"source" text NOT NULL DEFAULT 'SYSTEM',
	"direction" text,
	"level" text NOT NULL,
	"msg" text NOT NULL,
	"time" timestamp NOT NULL,
	"details" jsonb
);

-- 4. Convertir measurements en hypertable TimescaleDB
SELECT create_hypertable('measurements', 'time', if_not_exists => true);

-- 5. Vérification
SELECT '✅ Toutes les tables ont été créées avec succès!' as status;
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
