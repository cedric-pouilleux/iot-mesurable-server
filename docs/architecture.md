# Architecture Backend

> Architecture modulaire basée sur Fastify, Drizzle ORM et TimescaleDB

## Table des Matières

- [Vue d'Ensemble](#vue-densemble)
- [Structure du Projet](#structure-du-projet)
- [Flux de Données](#flux-de-données)
- [Plugins Fastify](#plugins-fastify)
- [Modules](#modules)

## Vue d'Ensemble

Le backend suit une architecture modulaire avec séparation des responsabilités :

```
┌─────────────┐
│   ESP32     │ MQTT
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│         Backend (Fastify)           │
│  ┌──────────┐  ┌─────────────────┐  │
│  │  MQTT    │  │   Socket.IO     │  │
│  │  Plugin  │  │   (WebSocket)   │  │
│  └────┬─────┘  └────────┬────────┘  │
│       │                 │           │
│       ▼                 ▼           │
│  ┌──────────────────────────────┐   │
│  │      Buffer (10s/100)        │   │
│  └──────────┬───────────────────┘   │
│             │                       │
│             ▼                       │
│  ┌──────────────────────────────┐   │
│  │   Drizzle ORM Repository     │   │
│  └──────────┬───────────────────┘   │
│             │                       │
│             ▼                       │
│  ┌──────────────────────────────┐   │
│  │  PostgreSQL + TimescaleDB    │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────┐
│  Frontend   │ REST API + WebSocket
└─────────────┘
```

## Structure du Projet

```
src/
├── app.ts                 # Factory Fastify + plugins
├── server.ts              # Entry point
├── config/
│   └── env.ts             # Variables d'environnement
├── db/
│   └── schema.ts          # Schéma Drizzle ORM
├── modules/               # Modules métier
│   ├── devices/
│   │   ├── routes.ts      # Routes API
│   │   ├── schema.ts      # Validation Zod
│   │   └── deviceRepository.ts  # Data access
│   └── system/
│       ├── routes.ts
│       └── schema.ts
├── plugins/               # Plugins Fastify
│   ├── db.ts              # PostgreSQL + Drizzle
│   ├── mqtt.ts            # Client MQTT
│   └── socketio.ts        # WebSocket
└── types/
    ├── api.ts             # Types API (camelCase)
    └── mqtt.ts            # Types MQTT (camelCase)
```

### Principes de Structure

1. **Modules** : Regroupement par fonctionnalité métier
2. **Plugins** : Infrastructure technique réutilisable
3. **Types** : Générés depuis Drizzle (mapping automatique DB ↔ TypeScript)
4. **Config** : Centralisée et typée

### Conventions de Nommage

- **Base de données** : `snake_case` (convention PostgreSQL)
- **TypeScript/API** : `camelCase` (convention JavaScript)
- **Mapping** : Automatique via Drizzle ORM (voir [Database](./database.md))

## Flux de Données

### 1. Ingestion MQTT → Base de Données

```typescript
// mqtt.ts
ESP32 → MQTT Broker
  ↓
handleMessage()
  ↓
Buffer.add(measurement)
  ↓
[10s OU 100 mesures]
  ↓
flushBuffer()
  ↓
fastify.pg.query(INSERT INTO measurements)
  ↓
PostgreSQL (TimescaleDB)
```

**Optimisations** :

- Batch inserts (100 mesures max)
- Intervalle de 5 secondes
- Réduction de 90% des écritures DB
- Normalisation automatique des données (chaînes vides → null, types mixtes)
- Gestion des conflits avec `onConflictDoUpdate`

### 2. Temps Réel → Frontend

```typescript
// mqtt.ts
MQTT message
  ↓
handleMessage()
  ↓
fastify.io.emit('mqtt-message', data)
  ↓
WebSocket → Frontend
```

**Avantages** :

- Latence < 100ms
- Pas de polling
- Scalable (Socket.IO clustering)

### 3. API REST → Frontend

```typescript
// routes.ts
GET /api/modules/:id/data
  ↓
DeviceRepository.getDeviceStatus()
  ↓
Drizzle ORM query (mapping automatique)
  ↓
PostgreSQL (JOIN device_system_status + device_hardware)
  ↓
Drizzle map: snake_case (DB) → camelCase (TypeScript)
  ↓
Response JSON (camelCase)
```

**Type Safety** :

- **Drizzle** : Mapping automatique DB (snake_case) → TypeScript (camelCase)
- **Zod** : Validation runtime
- **Orval** : API → Frontend types

## Plugins Fastify

### db.ts - Database

```typescript
fastify.db // Drizzle ORM instance
fastify.pg // pg.Pool pour raw SQL
```

**Utilisation** :

- Drizzle pour queries typées
- pg.Pool pour TimescaleDB spécifiques

### mqtt.ts - MQTT Client

```typescript
fastify.publishConfig(moduleId, config)
```

**Responsabilités** :

- Connexion MQTT broker
- Buffering des mesures
- Broadcast WebSocket
- Mise à jour DB

### socketio.ts - WebSocket

```typescript
fastify.io.emit(event, data)
```

**Events** :

- `mqtt-message` : Nouveau message MQTT
- `config-update` : Configuration modifiée

## Modules

### devices/

**Responsabilité** : Gestion des modules IoT et capteurs

**Routes** :

- `GET /api/modules` : Liste modules
- `GET /api/modules/:id/data` : Status + historique
- `POST /api/modules/:id/config` : Configuration

**Repository** :

- Queries Drizzle ORM (mapping automatique DB → TypeScript)
- Types générés depuis le schéma Drizzle
- Agrégations TimescaleDB

### system/

**Responsabilité** : Métriques système et base de données

**Routes** :

- `GET /api/db-size` : Taille DB
- `GET /api/metrics-history` : Historique métriques
- `GET /api/storage` : Détails stockage

## Voir Aussi

- [Database](./database.md) - Schéma et Drizzle ORM
- [MQTT](./mqtt.md) - Configuration et buffering
- [API](./api.md) - Endpoints et conventions
