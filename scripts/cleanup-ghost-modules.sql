-- Script de réparation et nettoyage pour la production
-- Ce script va :
-- 1. Supprimer les modules fantômes ('dev', 'home')
-- 2. Réinitialiser la table measurements qui utilise un ancien schéma incompatible
-- 3. Recréer les tables avec le bon schéma pour supporter le module 'croissance'

BEGIN;

-- 1. Nettoyage des métadonnées (Modules fantômes)
DELETE FROM device_system_status WHERE module_id IN ('dev', 'home');
DELETE FROM device_hardware WHERE module_id IN ('dev', 'home');
DELETE FROM sensor_status WHERE module_id IN ('dev', 'home');
DELETE FROM sensor_config WHERE module_id IN ('dev', 'home');

-- 2. Réinitialisation de la table measurements (Schéma incorrect détecté en prod)
-- On supprime l'ancienne table qui bloquait les insertions
DROP TABLE IF EXISTS measurements CASCADE;
DROP TABLE IF EXISTS measurements_hourly CASCADE;

-- 3. Recréation de la table measurements (Schéma V2 correct)
CREATE TABLE "measurements" (
	"time" timestamptz NOT NULL,
	"module_id" text NOT NULL,
	"sensor_type" text NOT NULL,
	"value" double precision NOT NULL,
	CONSTRAINT "measurements_time_module_id_sensor_type_pk" PRIMARY KEY("time","module_id","sensor_type")
);

-- 4. Recréation de la table measurements_hourly (Cache pour les graphiques)
CREATE TABLE "measurements_hourly" (
	"bucket" timestamp NOT NULL,
	"module_id" text NOT NULL,
	"sensor_type" text NOT NULL,
	"avg_value" double precision,
	"min_value" double precision,
	"max_value" double precision,
	"count" integer
);

-- 5. Conversion en hypertable TimescaleDB (Optimisation performances)
-- Note: Si cette étape échoue, ce n'est pas critique pour le fonctionnement immédiat,
-- mais c'est mieux pour les performances à long terme.
SELECT create_hypertable('measurements', 'time', if_not_exists => TRUE);

COMMIT;
