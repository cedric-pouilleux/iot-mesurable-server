# Tests

> Infrastructure de tests avec Vitest et patterns de tests

## Table des Matières

- [Configuration](#configuration)
- [Commandes](#commandes)
- [Architecture de Tests](#architecture-de-tests)
- [Conventions](#conventions)

## Configuration

### Vitest

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
})
```

## Commandes

```bash
npm run test           # Exécuter tous les tests
npm run test:unit      # Tests unitaires seulement
npm run test:watch     # Mode watch
npm run test:coverage  # Avec couverture
```

## Architecture de Tests

### Structure des Dossiers

```
src/modules/
├── mqtt/
│   ├── service.ts           # Logique pure (testable)
│   ├── mqttMessageHandler.ts # Orchestration (Fastify)
│   └── __tests__/
│       └── service.test.ts  # Tests unitaires
├── devices/
│   ├── service.ts
│   ├── controller.ts
│   └── __tests__/
│       └── service.test.ts
```

### Pattern Service Layer

La logique métier est extraite dans des **services** avec des fonctions pures :

```typescript
// ❌ Avant : logique dans le handler (difficile à tester)
class MqttMessageHandler {
  private parseTopic(topic: string) { /* ... */ }
}

// ✅ Après : fonctions pures exportées
export function parseTopic(topic: string): TopicParts | null {
  // ...
}
```

**Avantages** :
- Tests sans mocks Fastify/DB
- Réutilisable
- Documentation par les tests

## Conventions

### Naming

- Fichiers : `*.test.ts`
- Describe : `module/function`
- It : `should [action] when [condition]`

### Structure des Tests

```typescript
describe('parseTopic', () => {
  describe('valid topics', () => {
    it('should parse module_id/category/sensor', () => {
      const result = parseTopic('croissance/dht22/temp')
      expect(result?.moduleId).toBe('croissance')
    })
  })

  describe('invalid topics', () => {
    it('should return null for empty string', () => {
      expect(parseTopic('')).toBeNull()
    })
  })
})
```

## Coverage Actuel

| Module | Service | Coverage |
|--------|---------|----------|
| MQTT | `service.ts` | 100% |
| Devices | `service.ts` | 100% |

## Voir Aussi

- [Architecture](./architecture.md) - Pattern Service Layer
- [MQTT](./mqtt.md) - Détails du module MQTT
