# Système de Logging

## Vue d'ensemble

Le système de logging capture et stocke tous les événements de l'application (backend, ESP32 devices) dans une table PostgreSQL `system_logs` pour faciliter le monitoring, le débogage et l'audit.

## Architecture

```
┌─────────────┐
│   ESP32     │ ─MQTT─┐
│ RemoteLogger│       │
└─────────────┘       ▼
                ┌──────────────┐      ┌──────────────┐
┌─────────────┐ │   Backend    │      │  PostgreSQL  │
│    API      │─▶│ Pino Logger  │─────▶│ system_logs  │
└─────────────┘ │   + Stream   │      └──────────────┘
                └──────────────┘             │
                                             ▼
                                      ┌──────────────┐
                                      │   Frontend   │
                                      │   /logs UI   │
                                      └──────────────┘
```

## Composants

### 1. Backend Logger (`src/lib/logger.ts`)

**Rôle** : Stream Pino personnalisé qui écrit les logs en base de données ET sur stdout.

**Fonctionnement** :
- Intercepte tous les logs Pino (niveau info et supérieur)
- Parse le JSON (level, msg, time, details)
- Mappe les niveaux numériques Pino (10, 20, 30...) vers des strings (trace, debug, info...)
- Insert dans `system_logs` via Drizzle ORM
- Gestion d'erreur : écrit sur stderr en cas d'échec d'insertion

**Ce qui est logué automatiquement** :
- Connexions/déconnexions MQTT
- Requêtes HTTP (Fastify auto-logging)
- Insertions de mesures en batch
- Envoi de configurations aux devices
- Erreurs et warnings

### 2. ESP32 RemoteLogger (`air-quality-esp32/src/RemoteLogger.cpp`)

**Rôle** : Permet aux ESP32 d'envoyer leurs logs critiques au backend via MQTT.

**Topic MQTT** : `{moduleId}/logs`

**Format** :
```json
{
  "level": "error",
  "msg": "CO2 sensor read error",
  "time": 12345678
}
```

**Utilisation dans le code ESP32** :
```cpp
if (logger) logger->error("SGP40 not found! Check wiring");
if (logger) logger->info("Sensor initialized successfully");
if (logger) logger->warn("Low battery detected");
```

**Niveaux supportés** : `trace`, `debug`, `info`, `warn`, `error`, `fatal`

### 3. Handler MQTT Backend (`src/modules/mqtt/mqttMessageHandler.ts`)

Capture les logs ESP32 depuis le topic MQTT et les enregistre :
```typescript
private handleDeviceLog(topic: string, payload: string, moduleId: string): boolean {
  const logEntry = JSON.parse(payload)
  fastify.log.info({
    level: logEntry.level,
    msg: `[${moduleId}] ${logEntry.msg}`,
    moduleId,
    deviceTime: logEntry.time,
  })
}
```

### 4. Politique de Rétention (`src/plugins/log-retention.ts`)

**Déclenchement** : Au démarrage du backend

**Action** : Supprime les logs > 7 jours

```sql
DELETE FROM system_logs WHERE time < NOW() - INTERVAL '7 days';
```

**Justification** : Limite la croissance de la base (~70-140 KB/device/semaine max)

### 5. API Logs (`src/modules/system/logs-routes.ts`)

**Endpoint** : `GET /api/logs`

**Paramètres** :
- `level` (optionnel) : Filtre par niveau (info, warn, error, etc.)
- `search` (optionnel) : Recherche dans msg et level
- `startDate` (optionnel) : ISO datetime
- `endDate` (optionnel) : ISO datetime
- `limit` (défaut: 100, max: 1000)
- `offset` (défaut: 0)

**Réponse** :
```json
{
  "logs": [
    {
      "id": "uuid",
      "level": "info",
      "msg": "📊 Measurement buffered...",
      "time": "2025-12-02T12:00:00.000Z",
      "details": { "pid": 1234, "hostname": "..." }
    }
  ],
  "total": 500,
  "limit": 100,
  "offset": 0
}
```

**Exemples d'utilisation** :

```bash
# Tous les logs (100 derniers)
curl http://localhost:3001/api/logs

# Logs d'erreur uniquement
curl http://localhost:3001/api/logs?level=error

# Recherche "MQTT"
curl http://localhost:3001/api/logs?search=MQTT

# Pagination
curl http://localhost:3001/api/logs?limit=50&offset=100
```

### 6. Frontend Logs Viewer (`app/pages/logs.vue`)

**Route** : `/logs`

**Fonctionnalités** :
- Table triée par date décroissante
- Filtres : niveau, recherche, limite
- Pagination
- Modal de détails JSON

**Badge coloré par niveau** :
- `trace` : gris
- `debug` : bleu
- `info` : vert
- `warn` : jaune
- `error` : rouge
- `fatal` : violet

## Schéma de Base de Données

```sql
CREATE TABLE system_logs (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL,
  msg TEXT NOT NULL,
  time TIMESTAMP NOT NULL,
  details JSONB
);
```

**Colonne `details`** : Contient les métadonnées JSON (pid, hostname, moduleId, etc.)

## Impact Stockage

**Estimation** :
- Backend : ~50-100 logs/jour
- ESP32 : ~10-20 logs/jour (errors uniquement)
- Taille moyenne : 100-200 bytes/log
- **Total 1 device** : ~70-140 KB/semaine
- **Total 10 devices** : ~1.4 MB/semaine
- **Total 100 devices** : ~14 MB/semaine

**Optimisations possibles** :
1. ✅ Rétention 7 jours (déjà implémenté)
2. Ne logger que ERROR/WARN depuis ESP32
3. Sampling (logger 1 événement sur N)
4. Compression TimescaleDB pour anciens logs

## Exemples d'Utilisation

### Backend : Logger manuellement

```typescript
// Dans n'importe quel handler Fastify
fastify.log.info({ msg: 'User action', userId: 123 })
fastify.log.error({ msg: 'Database error', error: err.message })
```

### ESP32 : Logger depuis le device

```cpp
// Dans main.cpp
if (logger) {
  logger->error("Sensor failure");
  logger->warn("Low memory");
  logger->info("Configuration updated");
}
```

### Frontend : Afficher les logs

1. Cliquez sur "Logs" dans la navigation
2. Utilisez les filtres pour affiner
3. Cliquez sur "Voir" pour le JSON complet

### SQL : Requêtes directes

```sql
-- Logs des 24 dernières heures
SELECT * FROM system_logs 
WHERE time > NOW() - INTERVAL '24 hours' 
ORDER BY time DESC;

-- Logs d'erreur uniquement
SELECT * FROM system_logs 
WHERE level IN ('error', 'fatal') 
ORDER BY time DESC 
LIMIT 50;

-- Logs d'un device spécifique
SELECT * FROM system_logs 
WHERE details @> '{"moduleId": "croissance"}' 
ORDER BY time DESC;

-- Statistiques par niveau
SELECT level, COUNT(*) 
FROM system_logs 
GROUP BY level 
ORDER BY count DESC;
```

## Debugging

### Logs n'apparaissent pas

1. **Backend** : Vérifier que le serveur est démarré et que la politique de rétention s'est exécutée
2. **ESP32** : Vérifier que `logger` est initialisé et que MQTT est connecté
3. **Base de données** : `SELECT COUNT(*) FROM system_logs;`

### Trop de logs

1. Augmenter le niveau minimum dans `app.ts` : `level: 'warn'` au lieu de `'info'`
2. Réduire la rétention : modifier `retention.sql` de 7 à 3 jours
3. Désactiver les logs ESP32 non critiques

### Requêtes lentes

1. Ajouter un index sur `time` : `CREATE INDEX ON system_logs(time DESC);`
2. Ajouter un index sur `level` : `CREATE INDEX ON system_logs(level);`
3. Utiliser TimescaleDB hypertable pour partitionnement automatique

## Maintenance

### Nettoyer manuellement

```sql
-- Supprimer tous les logs > 30 jours
DELETE FROM system_logs WHERE time < NOW() - INTERVAL '30 days';

-- Supprimer tous les logs "trace" et "debug"
DELETE FROM system_logs WHERE level IN ('trace', 'debug');
```

### Exporter les logs

```bash
# Export CSV
psql -h localhost -U postgres -d iot_data \
  -c "COPY (SELECT * FROM system_logs ORDER BY time DESC LIMIT 1000) TO STDOUT CSV HEADER" \
  > logs_export.csv
```

### Backup avant suppression

```bash
# Backup de la table
pg_dump -h localhost -U postgres -d iot_data -t system_logs > system_logs_backup.sql
```

## Notes pour l'IA

- Les logs sont stockés dans `system_logs` (PostgreSQL)
- Le backend utilise Pino avec un stream personnalisé
- Les ESP32 envoient leurs logs via MQTT sur `{moduleId}/logs`
- La rétention est de 7 jours par défaut
- L'API est disponible sur `GET /api/logs` avec filtres et pagination
- Le frontend est accessible sur `/logs` avec UI de filtrage
