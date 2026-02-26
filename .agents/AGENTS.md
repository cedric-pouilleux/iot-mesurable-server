# IoT Mesurable - Backend Server

Backend Fastify + TypeScript pour le dashboard IoT. Reçoit les données MQTT, les stocke dans TimescaleDB, et sert l'API REST + WebSocket.

## Stack technique

- **Framework** : Fastify v5
- **Language** : TypeScript
- **ORM** : Drizzle ORM (mapping auto DB ↔ TS)
- **Validation** : Zod
- **Database** : PostgreSQL + TimescaleDB
- **Real-time** : Socket.IO + MQTT
- **API docs** : Swagger (http://localhost:3001/documentation)

## Conventions de nommage (IMPORTANT)

| Contexte | Convention | Exemple |
|----------|-----------|---------|
| Base de données | `snake_case` | `module_id`, `heap_free_kb` |
| TypeScript/API | `camelCase` | `moduleId`, `heapFreeKb` |
| Schéma Drizzle | Mapping explicite | `moduleId: text('module_id')` |

**Règle d'or** : Ne jamais mapper manuellement, Drizzle le fait automatiquement.

## Structure du projet

```
src/
├── app.ts                  # Factory Fastify + plugins
├── server.ts               # Entry point
├── config/env.ts           # Variables d'environnement
├── db/schema.ts            # Schéma Drizzle ORM
├── modules/
│   ├── devices/            # Gestion modules IoT (routes, controller, service, repo)
│   ├── mqtt/               # Ingestion MQTT (handler, repo, service)
│   └── system/             # Métriques système
├── plugins/                # db.ts, mqtt.ts, socketio.ts
└── types/                  # api.ts, mqtt.ts
```

## Base de données

### Tables principales
- `device_system_status` → Statut système (PK: `module_id, chip_id`)
- `device_hardware` → Info hardware (PK: `module_id, chip_id`)
- `sensor_status` → Statut capteurs (PK: `module_id, chip_id, sensor_type`)
- `sensor_config` → Config capteurs (PK: `module_id, chip_id, sensor_type`)
- `measurements` → Données séries temporelles (hypertable TimescaleDB)

### ChipId
Le `chipId` est dérivé de l'adresse MAC de l'ESP32. C'est l'identifiant unique du hardware physique. Clé composite `(module_id, chip_id)` pour toutes les tables device.

### Stratégie d'agrégation historique
- **< 1 jour** : Données brutes
- **1-7 jours** : Agrégation par minute
- **> 7 jours** : Agrégation par heure (vue matérialisée)

## Buffering MQTT

Les mesures sont bufferisées avant insertion DB :
- Flush toutes les **5 secondes** OU **100 mesures**
- Réduction de **90%** des écritures DB
- En cas d'erreur DB, les mesures sont remises dans le buffer

## Commandes utiles

```bash
npm run dev          # Dev mode
npm run build        # Build prod
npm run db:reset     # ⚠️ Reset complet DB
npm run db:generate  # Générer migrations
npm run db:migrate   # Appliquer migrations
npm run db:push      # Appliquer schéma direct
npm run db:studio    # Interface web DB
```

## Génération des types frontend

```bash
cd ../iot-mesurable-nuxt-app
npm run gen:api      # Génère les types depuis Swagger
```
