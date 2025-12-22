# Base de Données

> PostgreSQL + TimescaleDB avec Drizzle ORM pour le typage et les migrations

## Table des Matières

- [Schéma](#schéma)
- [Drizzle ORM](#drizzle-orm)
- [Conventions de Nommage](#conventions-de-nommage)
- [TimescaleDB](#timescaledb)
- [Migrations](#migrations)

## Schéma

### Tables Principales

#### `device_system_status`

Statut système des modules IoT

```sql
CREATE TABLE device_system_status (
    module_id TEXT PRIMARY KEY,
    ip TEXT,
    mac TEXT,
    uptime_start BIGINT,
    rssi INTEGER,
    flash_used_kb INTEGER,
    flash_free_kb INTEGER,
    flash_system_kb INTEGER,
    heap_total_kb INTEGER,
    heap_free_kb INTEGER,
    heap_min_free_kb INTEGER,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `device_hardware`

Informations matérielles (CPU, flash, etc.)

```sql
CREATE TABLE device_hardware (
    module_id TEXT PRIMARY KEY,
    chip_model TEXT,
    chip_rev INTEGER,
    cpu_freq_mhz INTEGER,
    flash_kb INTEGER,
    cores INTEGER,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `sensor_status`

Statut actuel des capteurs

```sql
CREATE TABLE sensor_status (
    module_id TEXT NOT NULL,
    sensor_type TEXT NOT NULL,
    status TEXT,
    value DOUBLE PRECISION,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (module_id, sensor_type)
);
```

#### `sensor_config`

Configuration des capteurs

```sql
CREATE TABLE sensor_config (
    module_id TEXT NOT NULL,
    sensor_type TEXT NOT NULL,
    interval_seconds INTEGER,
    model TEXT,
    enabled BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (module_id, sensor_type)
);
```

#### `measurements` (TimescaleDB Hypertable)

Mesures des capteurs (séries temporelles)

```sql
CREATE TABLE measurements (
    time TIMESTAMPTZ NOT NULL,
    module_id TEXT NOT NULL,
    sensor_type TEXT NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (time, module_id, sensor_type)
);

-- Convertir en hypertable TimescaleDB
SELECT create_hypertable('measurements', 'time');
```

## Drizzle ORM

### Configuration

**drizzle.config.ts** :

```typescript
export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
}
```

### Schéma TypeScript

**src/db/schema.ts** :

```typescript
import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core'

export const deviceSystemStatus = pgTable('device_system_status', {
  moduleId: text('module_id').primaryKey(),
  ip: text('ip'),
  mac: text('mac'),
  uptimeStart: integer('uptime_start'),
  rssi: integer('rssi'),
  updatedAt: timestamp('updated_at').defaultNow(),
  // ...
})

export const measurements = pgTable('measurements', {
  time: timestamp('time', { withTimezone: true }).notNull(), // TIMESTAMPTZ
  moduleId: text('module_id').notNull(),
  sensorType: text('sensor_type').notNull(),
  value: doublePrecision('value').notNull(),
})
```

### Utilisation dans les Repositories

```typescript
import { eq } from 'drizzle-orm'
import * as schema from '../db/schema'

export class DeviceRepository {
  constructor(private db: NodePgDatabase<typeof schema>) {}

  async getDeviceStatus(moduleId: string) {
    const result = await this.db
      .select({
        moduleId: schema.deviceSystemStatus.moduleId,
        ip: schema.deviceSystemStatus.ip,
        // Mapping explicite pour clarté
      })
      .from(schema.deviceSystemStatus)
      .leftJoin(
        schema.deviceHardware,
        eq(schema.deviceSystemStatus.moduleId, schema.deviceHardware.moduleId)
      )
      .where(eq(schema.deviceSystemStatus.moduleId, moduleId))

    return result[0] || null
  }
}
```

## Conventions de Nommage

### Principe : Mapping Automatique DB ↔ TypeScript

**PostgreSQL utilise snake_case** (convention standard)  
**TypeScript/API utilise camelCase** (convention JavaScript)

Drizzle ORM fait le mapping automatiquement via le schéma :

```typescript
// src/db/schema.ts
export const deviceSystemStatus = pgTable('device_system_status', {
  moduleId: text('module_id'), // DB: module_id → TS: moduleId
  heapFreeKb: integer('heap_free_kb'), // DB: heap_free_kb → TS: heapFreeKb
  uptimeStart: integer('uptime_start'), // DB: uptime_start → TS: uptimeStart
  updatedAt: timestamp('updated_at'), // DB: updated_at → TS: updatedAt
})
```

### Base de Données (snake_case) ✅

**Toutes les colonnes en base de données sont en snake_case** :

```sql
-- Requête SQL directe
SELECT module_id, heap_free_kb, uptime_start
FROM device_system_status;
```

### API REST (camelCase)

```json
{
  "moduleId": "croissance",
  "heapFreeKb": 123,
  "uptimeStart": 456
}
```

### Mapping Automatique dans le Code

**Vous n'avez jamais besoin de faire le mapping manuellement** :

```typescript
// Repository - Drizzle fait le mapping automatiquement
const status = await db
  .select()
  .from(deviceSystemStatus)
  .where(eq(deviceSystemStatus.moduleId, 'croissance'))

// status[0].moduleId ✅ camelCase (pas besoin de conversion)
// status[0].heapFreeKb ✅ camelCase
```

**Dans les requêtes SQL brutes** (avec `sql` template) :

```typescript
// Les colonnes DB restent en snake_case
const result = await db.execute<{
  module_id: string // DB column name
  heap_free_kb: number
}>(sql`
  SELECT module_id, heap_free_kb 
  FROM device_system_status
`)

// Mais vous pouvez mapper vers camelCase dans le résultat
const mapped = result.rows.map(row => ({
  moduleId: row.module_id, // Mapping manuel si nécessaire
  heapFreeKb: row.heap_free_kb,
}))
```

### Règles à Suivre

1. **Schéma Drizzle** : Toujours définir le mapping explicitement

   ```typescript
   moduleId: text('module_id') // ✅ Nom TS: 'nom_db'
   ```

2. **Requêtes Drizzle** : Utiliser les propriétés camelCase

   ```typescript
   schema.deviceSystemStatus.moduleId // ✅ camelCase
   ```

3. **SQL brut** : Utiliser snake_case pour les colonnes

   ```sql
   SELECT module_id FROM device_system_status  -- ✅ snake_case
   ```

4. **Types API** : Toujours camelCase
   ```typescript
   interface DeviceStatus {
     moduleId: string // ✅ camelCase
   }
   ```

## TimescaleDB

### Hypertable

La table `measurements` est une hypertable TimescaleDB :

```sql
SELECT create_hypertable('measurements', 'time');
```

**Avantages** :

- Partitionnement automatique par temps
- Compression automatique
- Requêtes optimisées sur séries temporelles

### Compression

```sql
ALTER TABLE measurements SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'module_id, sensor_type'
);

SELECT add_compression_policy('measurements', INTERVAL '7 days');
```

**Résultat** : Réduction de 90% de l'espace disque

### Rétention

```sql
SELECT add_retention_policy('measurements', INTERVAL '90 days');
```

### Continuous Aggregates

```sql
CREATE MATERIALIZED VIEW measurements_hourly
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', time) AS bucket,
  module_id,
  sensor_type,
  AVG(value) AS avg_value,
  MIN(value) AS min_value,
  MAX(value) AS max_value,
  COUNT(*) AS count
FROM measurements
GROUP BY bucket, module_id, sensor_type;
```

### Récupération des Données Historiques

La stratégie d'agrégation dépend de la période demandée :

- **< 1 jour** : Données brutes (pas d'agrégation) pour correspondre au temps réel
- **1-7 jours** : Agrégation par minute (`time_bucket('1 minute')` avec `AVG(value)`)
- **> 7 jours** : Agrégation par heure (vue matérialisée `measurements_hourly`)

Cela garantit que les graphiques temps réel et historiques affichent les mêmes valeurs pour les données récentes.

## Migrations

### Réinitialiser la Base de Données

**⚠️ ATTENTION : Supprime toutes les données !**

```bash
npm run db:reset
```

Supprime et recrée toutes les tables avec le schéma actuel. Utilisez ce script pour :

- Réinitialiser complètement la base après des changements de schéma
- Corriger les problèmes de structure (timezone, types, etc.)
- Partir d'une base propre

### Générer une Migration

```bash
npm run db:generate
```

Crée un fichier SQL dans `drizzle/` basé sur les changements du schéma.

### Appliquer les Migrations

```bash
npm run db:migrate
```

Exécute les migrations en attente.

### Drizzle Studio

Interface web pour explorer la DB :

```bash
npm run db:studio
```

Ouvre `https://local.drizzle.studio`

### Autres Commandes

```bash
npm run db:push    # Applique directement le schéma (sans migrations)
```

## Résumé des Conventions

| Contexte            | Convention        | Exemple                       |
| ------------------- | ----------------- | ----------------------------- |
| **Base de données** | `snake_case`      | `module_id`, `heap_free_kb`   |
| **TypeScript**      | `camelCase`       | `moduleId`, `heapFreeKb`      |
| **API JSON**        | `camelCase`       | `{"moduleId": "..."}`         |
| **Schéma Drizzle**  | Mapping explicite | `moduleId: text('module_id')` |

**Règle d'or** : Vous n'avez jamais besoin de faire le mapping manuellement. Drizzle s'en charge automatiquement.

## Voir Aussi

- [Architecture](./architecture.md) - Vue d'ensemble
- [MQTT](./mqtt.md) - Messages et buffering
- [API](./api.md) - Endpoints et types
