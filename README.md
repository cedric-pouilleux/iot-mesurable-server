# IoT Backend

Modern, scalable backend for IoT Dashboard with **Fastify**, **Drizzle ORM**, and **TimescaleDB**.

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL with TimescaleDB
- MQTT Broker (Mosquitto)

### Installation

```bash
npm install
cp .env.example .env  # Configure your environment
npm run dev           # Start development server
```

Server runs on `http://localhost:3001`

## 📚 Documentation

- **[Architecture](./docs/architecture.md)** - Project structure & data flow
- **[Database](./docs/database.md)** - Schema, Drizzle ORM, migrations
- **[MQTT](./docs/mqtt.md)** - Real-time messaging & buffering
- **[API Documentation](http://localhost:3001/documentation)** - Swagger UI (when server is running)

> **For Contributors**: Read [Documentation Guidelines](./docs/DOCUMENTATION_GUIDELINES.md) before editing docs

## 🛠️ Development

```bash
npm run dev          # Watch mode
npm run build        # Production build
npm start            # Run production
```

### Drizzle ORM

```bash
npm run db:reset     # Réinitialiser complètement la base (⚠️ supprime toutes les données)
npm run db:generate  # Générer des migrations
npm run db:migrate   # Appliquer les migrations
npm run db:push      # Appliquer directement le schéma (sans migrations)
npm run db:studio    # Ouvrir Drizzle Studio
```

### Frontend Type Generation

```bash
cd ../nuxt-app
npm run gen:api      # Generate types from Swagger
```

## 🏗️ Tech Stack

- **Framework**: Fastify v5
- **Language**: TypeScript
- **ORM**: Drizzle ORM (mapping automatique DB ↔ TypeScript)
- **Validation**: Zod
- **Database**: PostgreSQL + TimescaleDB
- **Real-time**: Socket.IO + MQTT

## 📝 Conventions de Nommage

- **Base de données** : `snake_case` (convention PostgreSQL)
- **TypeScript/API** : `camelCase` (convention JavaScript)
- **Mapping** : Automatique via Drizzle ORM

Voir [Database Documentation](./docs/database.md#conventions-de-nommage) pour plus de détails.

## 📜 Recent Changes

**Dec 2025** - Data Consistency & Timezone Fixes

- Fixed timezone issues: `measurements.time` now uses `TIMESTAMPTZ`
- Improved data normalization: empty strings → null, type conversion
- Historical data strategy: raw data for < 1 day, aggregated for longer periods
- Better conflict handling: `onConflictDoUpdate` instead of `onConflictDoNothing`
- Added `db:reset` script for complete database reset

**Nov 2025** - Drizzle ORM Migration

- Migrated from raw SQL to Drizzle ORM
- Full TypeScript type safety
- Automatic mapping: DB (snake_case) ↔ TypeScript (camelCase)
- Repository pattern for data access
- Strong typing throughout the codebase

**Nov 2025** - TypeScript & Fastify Migration

- Converted from Express/JS to Fastify/TS
- Added Zod validation
- Implemented MQTT buffering
- Added Swagger documentation
