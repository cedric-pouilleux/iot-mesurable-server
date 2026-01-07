-- Migration 0006: Add chip_id column to all tables
-- This migration adds chip_id to support unique hardware identification
-- For existing data, we derive chip_id from MAC address as a placeholder

-- Step 1: Add chip_id column (nullable initially)
ALTER TABLE "device_system_status" ADD COLUMN "chip_id" text;
ALTER TABLE "device_hardware" ADD COLUMN "chip_id" text;
ALTER TABLE "sensor_status" ADD COLUMN "chip_id" text;
ALTER TABLE "sensor_config" ADD COLUMN "chip_id" text;
ALTER TABLE "measurements" ADD COLUMN "chip_id" text;
ALTER TABLE "measurements_hourly" ADD COLUMN "chip_id" text;

-- Step 2: Populate chip_id for existing data
-- For device_system_status and related tables, use MAC address as chipId placeholder
UPDATE "device_system_status" 
SET "chip_id" = COALESCE(REPLACE("mac", ':', ''), 'UNKNOWN_' || "module_id")
WHERE "chip_id" IS NULL;

UPDATE "device_hardware"
SET "chip_id" = (SELECT COALESCE(REPLACE(d."mac", ':', ''), 'UNKNOWN_' || d."module_id")
                 FROM "device_system_status" d 
                 WHERE d."module_id" = "device_hardware"."module_id")
WHERE "chip_id" IS NULL;

UPDATE "sensor_status"
SET "chip_id" = (SELECT COALESCE(REPLACE(d."mac", ':', ''), 'UNKNOWN_' || d."module_id")
                 FROM "device_system_status" d 
                 WHERE d."module_id" = "sensor_status"."module_id")
WHERE "chip_id" IS NULL;

UPDATE "sensor_config"
SET "chip_id" = (SELECT COALESCE(REPLACE(d."mac", ':', ''), 'UNKNOWN_' || d."module_id")
                 FROM "device_system_status" d 
                 WHERE d."module_id" = "sensor_config"."module_id")
WHERE "chip_id" IS NULL;

UPDATE "measurements"
SET "chip_id" = (SELECT COALESCE(REPLACE(d."mac", ':', ''), 'UNKNOWN_' || d."module_id")
                 FROM "device_system_status" d 
                 WHERE d."module_id" = "measurements"."module_id")
WHERE "chip_id" IS NULL;

UPDATE "measurements_hourly"
SET "chip_id" = (SELECT COALESCE(REPLACE(d."mac", ':', ''), 'UNKNOWN_' || d."module_id")
                 FROM "device_system_status" d 
                 WHERE d."module_id" = "measurements_hourly"."module_id")
WHERE "chip_id" IS NULL;

-- Step 3: Make chip_id NOT NULL
ALTER TABLE "device_system_status" ALTER COLUMN "chip_id" SET NOT NULL;
ALTER TABLE "device_hardware" ALTER COLUMN "chip_id" SET NOT NULL;
ALTER TABLE "sensor_status" ALTER COLUMN "chip_id" SET NOT NULL;
ALTER TABLE "sensor_config" ALTER COLUMN "chip_id" SET NOT NULL;
ALTER TABLE "measurements" ALTER COLUMN "chip_id" SET NOT NULL;
ALTER TABLE "measurements_hourly" ALTER COLUMN "chip_id" SET NOT NULL;

-- Step 4: Drop old primary keys
ALTER TABLE "device_system_status" DROP CONSTRAINT IF EXISTS "device_system_status_pkey";
ALTER TABLE "device_hardware" DROP CONSTRAINT IF EXISTS "device_hardware_pkey";
ALTER TABLE "sensor_status" DROP CONSTRAINT IF EXISTS "sensor_status_module_id_sensor_type_pk";
ALTER TABLE "sensor_config" DROP CONSTRAINT IF EXISTS "sensor_config_module_id_sensor_type_pk";
ALTER TABLE "measurements" DROP CONSTRAINT IF EXISTS "measurements_time_module_id_sensor_type_hardware_id_pk";

-- Step 5: Create new composite primary keys
ALTER TABLE "device_system_status" 
  ADD CONSTRAINT "device_system_status_module_id_chip_id_pk" 
  PRIMARY KEY ("module_id", "chip_id");

ALTER TABLE "device_hardware" 
  ADD CONSTRAINT "device_hardware_module_id_chip_id_pk" 
  PRIMARY KEY ("module_id", "chip_id");

ALTER TABLE "sensor_status" 
  ADD CONSTRAINT "sensor_status_module_id_chip_id_sensor_type_pk" 
  PRIMARY KEY ("module_id", "chip_id", "sensor_type");

ALTER TABLE "sensor_config" 
  ADD CONSTRAINT "sensor_config_module_id_chip_id_sensor_type_pk" 
  PRIMARY KEY ("module_id", "chip_id", "sensor_type");

ALTER TABLE "measurements" 
  ADD CONSTRAINT "measurements_time_module_id_chip_id_sensor_type_hardware_id_pk" 
  PRIMARY KEY ("time", "module_id", "chip_id", "sensor_type", "hardware_id");

-- Step 6: Update indexes
DROP INDEX IF EXISTS "measurements_module_id_time_idx";
CREATE INDEX "measurements_module_id_chip_id_time_idx" ON "measurements" ("module_id", "chip_id", "time");
