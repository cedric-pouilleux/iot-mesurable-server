# Actions pour Nettoyer les Modules UNKNOWN

## Situation Actuelle

**4 modules ESP32 physiques actifs:**

| Module | ChipId | Firmware | Action |
|--------|--------|----------|---------|
| air-quality | ✅ 0000347B4EE81F84 | Nouveau | OK |
| air-quality-benchmark | ✅ 000010D368641D44 | Nouveau | OK |
| module-air-bootstrap | ❌ UNKNOWN | Ancien | À gérer |
| module-esp32-1 | ❌ UNKNOWN | Ancien | À gérer |

## Problème

Les 2 anciens modules republient constamment SANS chipId, recréant les entrées `@UNKNOWN` en base.

## Solutions

### Option 1: Débrancher (Recommandé si modules de test)
```bash
# Simplement débrancher physiquement les 2 modules
# Ou les éteindre
```

### Option 2: Flasher Nouveau Firmware
```bash
# Pour module-air-bootstrap
cd d:\dev-iot\iot-mesurable-module-air
pio run --target upload --upload-port COM<X>

# Pour module-esp32-1  
cd d:\dev-iot\iot-mesurable-module-air-benchmark
pio run --target upload --upload-port COM<Y>
```

### Option 3: Filtrer dans le Serveur (Temporaire)

Ajouter un filtre pour ignorer ces modules:

```typescript
// Dans mqttMessageHandler.ts
handleSystemMessage(topic: string, payload: string, moduleId: string) {
  // Ignore old test modules
  if (moduleId === 'module-air-bootstrap' || moduleId === 'module-esp32-1') {
    return true
  }
  // ... rest of code
}
```

### Option 4: Script de Nettoyage Automatique

Créer un cron job qui nettoie périodiquement:
```bash
# Tous les 5 minutes
*/5 * * * * cd /path/to/server && npx tsx scripts/cleanup-unknown-chipid.ts
```

## Vérification

Une fois les modules gérés:

```bash
# Vérifier qu'il ne reste que 2 modules
curl http://localhost:3001/api/modules | jq length

# Devrait retourner: 2
```

## Recommendation

**Débranchez les 2 anciens modules** si ce sont des modules de test que vous n'utilisez plus.
Sinon, flashez-leur le nouveau firmware.
