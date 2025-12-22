-- Migration: Ajout de la table system_logs
-- Cette table était définie dans le schéma Drizzle mais manquait dans la migration initiale

CREATE TABLE IF NOT EXISTS "system_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"level" text NOT NULL,
	"msg" text NOT NULL,
	"time" timestamp NOT NULL,
	"details" jsonb
);

-- Index pour améliorer les performances des requêtes par catégorie et niveau
CREATE INDEX IF NOT EXISTS "system_logs_category_idx" ON "system_logs" ("category");
CREATE INDEX IF NOT EXISTS "system_logs_level_idx" ON "system_logs" ("level");
CREATE INDEX IF NOT EXISTS "system_logs_time_idx" ON "system_logs" ("time");

