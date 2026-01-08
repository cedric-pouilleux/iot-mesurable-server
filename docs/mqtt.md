# MQTT & Temps Réel

> Configuration MQTT, buffering et diffusion WebSocket

## Table des Matières

- [Configuration](#configuration)
- [Topics](#topics)
- [Buffering](#buffering)
- [WebSocket](#websocket)
- [Gestion des Erreurs](#gestion-des-erreurs)

## Configuration

### Variables d'Environnement

```env
MQTT_BROKER=mqtt://localhost:1883
MQTT_USERNAME=
MQTT_PASSWORD=
```

### Connexion

```typescript
// src/plugins/mqtt.ts
const client = mqtt.connect(config.mqtt.broker, {
  username: config.mqtt.username,
  password: config.mqtt.password,
  reconnectPeriod: 5000,
  connectTimeout: 30000,
})
```

## Topics

### Structure

Le système utilise deux formats de topics :

**Configuration/Status** :
```
{module_id}/{category}[/{subcategory}]
```

**Mesures capteurs (Hardware-aware)** :
```
{module_id}/{hardware_id}/{measurement_type}
```

**Exemples** :

```
# Configuration & Status
croissance/system
croissance/system/config
croissance/sensors/status
croissance/sensors/config
croissance/hardware/config

# Mesures capteurs (format hardware-aware)
croissance/dht22/temperature
croissance/dht22/humidity
croissance/sht31/temperature
croissance/sht31/humidity
croissance/bmp280/pressure
croissance/sgp40/voc
```

> **Note** : Le format `{module_id}/{hardware_id}/{measurement}` permet d'identifier précisément la source d'une mesure quand plusieurs capteurs mesurent le même type (ex: DHT22 et SHT31 mesurent tous deux température et humidité).

### Types de Messages

#### System Status

**Topic** : `{module_id}/system`

**Payload** (camelCase) :

```json
{
  "rssi": -45,
  "memory": {
    "heapFreeKb": 123,
    "heapMinFreeKb": 45
  }
}
```

**Action** : Mise à jour `device_system_status` (mapping automatique DB snake_case)

#### System Config

**Topic** : `{module_id}/system/config`

**Payload** (camelCase) :

```json
{
  "chipId": "0000347B4EE81F84",
  "moduleType": "air-quality",
  "ip": "192.168.1.100",
  "mac": "AA:BB:CC:DD:EE:FF",
  "uptimeStart": 1234567890,
  "flash": {
    "usedKb": 500,
    "freeKb": 1500,
    "systemKb": 200
  },
  "memory": {
    "heapTotalKb": 320,
    "heapFreeKb": 280,
    "heapMinFreeKb": 150
  }
}
```

> **Important** : Le `chipId` est l'identifiant unique du hardware (dérivé de l'adresse MAC). Il est utilisé comme clé primaire composite avec `moduleId` pour identifier uniquement chaque device physique, même si plusieurs ont le même `moduleId`.

**Action** : Mise à jour `device_system_status` avec clé `(module_id, chip_id)`

#### Hardware Config

**Topic** : `{module_id}/hardware/config`

**Payload** (camelCase) :

```json
{
  "chip": {
    "model": "ESP32",
    "rev": 3,
    "cpuFreqMhz": 240,
    "flashKb": 4096,
    "cores": 2
  }
}
```

**Action** : Mise à jour `device_hardware` (mapping automatique DB snake_case)

#### Sensor Data (Hardware-aware)

**Topic** : `{module_id}/{hardware_id}/{measurement_type}`

**Exemples** :
- `croissance/dht22/temperature`
- `croissance/sht31/humidity`
- `croissance/bmp280/pressure`
- `croissance/sgp40/voc`

**Payload** : Valeur numérique brute

```
22.5
```

**Action** : Buffer → Batch insert `measurements` avec `hardware_id` et `chip_id`

> **Note** : Le `hardware_id` (ex: "dht22", "sht31") permet de distinguer les mesures provenant de différents capteurs physiques, même si le type de mesure est identique.

## Buffering

### Stratégie

```typescript
const FLUSH_INTERVAL = 5000 // 5 secondes
const BATCH_SIZE = 100 // 100 mesures

// Flush automatique sur :
// - Intervalle de 5s
// - Taille max de 100 mesures
```

### Implémentation

```typescript
// src/plugins/mqtt.ts
const measurementBuffer: MqttMeasurement[] = []

async function flushMeasurements() {
  if (measurementBuffer.length === 0) return

  const batch = [...measurementBuffer]
  measurementBuffer = []

  // Insertion batch via Drizzle (mapping automatique)
  await mqttRepo.insertMeasurementsBatch(batch)
}

// Flush périodique
setInterval(flushMeasurements, FLUSH_INTERVAL)
```

**Note** : Les mesures sont en camelCase dans TypeScript (`moduleId`, `sensorType`) mais insérées en snake_case dans la DB (`module_id`, `sensor_type`) automatiquement par Drizzle.

### Avantages

- **Performance** : Réduction de 90% des écritures DB
- **Scalabilité** : Supporte 100+ capteurs simultanés
- **Fiabilité** : Pas de perte de données (buffer en mémoire)

## WebSocket

### Diffusion en Temps Réel

```typescript
// Broadcast tous les messages MQTT
fastify.io.emit('mqtt-message', {
  topic: message.topic,
  value: message.value,
  time: message.time,
  metadata: message.metadata,
})
```

### Frontend

```typescript
// Frontend reçoit et traite
socket.on('mqtt-message', message => {
  handleModuleMessage(moduleId, message)
})
```

### Latence

- **MQTT → Backend** : < 50ms
- **Backend → Frontend** : < 50ms
- **Total** : < 100ms

## Gestion des Erreurs

### Reconnexion MQTT

```typescript
client.on('error', err => {
  fastify.log.error('MQTT error:', err)
})

client.on('reconnect', () => {
  fastify.log.info('MQTT reconnecting...')
})

client.on('connect', () => {
  fastify.log.info('✅ MQTT connected')
  client.subscribe('#') // Subscribe all topics
})
```

### Buffer Overflow

Si le buffer dépasse la taille max avant le flush :

1. Flush immédiat
2. Log warning
3. Continuer l'opération

### Database Errors

```typescript
try {
  await flushBuffer()
} catch (err) {
  fastify.log.error('❌ Buffer flush failed:', err)
  // Les mesures sont remises dans le buffer pour réessayer plus tard
  measurementBuffer.unshift(...batch)
}
```

### Normalisation des Données

Toutes les données MQTT sont normalisées avant insertion dans la base :

- **Chaînes vides** → `null`
- **Nombres invalides** → `null`
- **Types mixtes** (string/number) → conversion automatique
- **Gestion des conflits** : `onConflictDoUpdate` pour éviter les doublons

Cela garantit la cohérence des données même si l'ESP32 envoie des formats variés.

## Voir Aussi

- [Architecture](./architecture.md) - Flux de données
- [Database](./database.md) - Schéma measurements
- [Testing](./testing.md) - Tests du service MQTT
- [API](./api.md) - Endpoints configuration
