# Mémos Techniques - IoT Mesurable

Ce fichier contient des notes techniques importantes, leçons apprises, et bonnes pratiques transversales au projet.

---

## 🏗️ Architecture Globale

```
┌─────────────────────┐
│   ESP32 Modules     │  (iot-mesurable-module-air, module-air-benchmark)
│   + Bootstrap Lib   │  (iot-mesurable-esp-bootstrap)
└──────────┬──────────┘
           │ MQTT (port 1883)
           ▼
┌──────────────────────────────────────────┐
│  Raspberry Pi 5 (iot-mesurable-infra)    │
│  ┌──────────────┐  ┌─────────────────┐   │
│  │  Mosquitto   │  │    Nginx        │   │
│  │  MQTT Broker │  │  Reverse Proxy  │   │
│  └──────┬───────┘  └────────┬────────┘   │
│         │                    │            │
│  ┌──────▼───────┐  ┌───────▼────────┐   │
│  │   Backend    │  │   Frontend     │   │
│  │   Fastify    │──│   Nuxt 3       │   │
│  └──────┬───────┘  └────────────────┘   │
│         │                                │
│  ┌──────▼──────────┐                    │
│  │  TimescaleDB    │                    │
│  │  PostgreSQL     │                    │
│  └─────────────────┘                    │
└──────────────────────────────────────────┘
```

Les 6 repos :
1. **iot-mesurable-esp-bootstrap** → Lib PlatformIO partagée
2. **iot-mesurable-module-air** → Module test (données simulées)
3. **iot-mesurable-module-air-benchmark** → Module prod (vrais capteurs)
4. **iot-mesurable-server** → Backend API + MQTT handler
5. **iot-mesurable-nuxt-app** → Dashboard frontend
6. **iot-mesurable-infra** → Docker + déploiement

---

## ⚡ Leçons Apprises

### I2C et capteurs
- **Double bus I2C obligatoire** : Le BMP280 est instable, l'isoler sur un bus séparé
- **SCD41 freeze** : Le capteur peut arrêter de reporter, nécessite un recovery I2C robuste
- **SGP30/SGP40** : Nécessitent un temps de chauffe (15s SGP40, 12h+ SGP30 pour baseline)
- **Pull-up DHT22** : Résistance 4.7kΩ - 10kΩ entre DATA et 3V3

### WiFi / MQTT
- **Perte de données à la déconnexion** : Pas de buffer local sur ESP32 — les données sont perdues
- **Reconnexion automatique** : Gérée par la lib bootstrap, pas besoin de code custom
- **chipId** : Dérivé de l'adresse MAC, identifiant unique du hardware physique
- **Broker unreachable** : Toujours vérifier d'abord que Mosquitto tourne (`docker-compose ps`)

### Base de données
- **TIMESTAMPTZ, pas TIMESTAMP** : Toujours utiliser le timezone-aware pour éviter les bugs
- **Normalisation** : Chaînes vides → null, conversion de types automatique
- **Conflits** : `onConflictDoUpdate` au lieu de `onConflictDoNothing`
- **Agrégation** : <1j brut, 1-7j par minute, >7j par heure

### Frontend
- **Proxy API** : Toujours passer par le proxy Nuxt en dev, pas de `localhost:3001` en dur
- **Types API** : Toujours utiliser les types Orval générés, jamais de types manuels
- **Socket.IO URL** : Attention à la config — en prod passe par Nginx

### Infrastructure
- **Raspberry Pi après coupure** : Peut devenir inaccessible sur le réseau, vérifier systemd
- **Alimentation ESP32** : USB standard (500mA) insuffisant avec tous les capteurs → 2A minimum

---

## 🔧 Commandes Fréquentes

### Dev
```bash
# Infra dev (TimescaleDB + Mosquitto)
cd d:\dev\iot-mesurable-infra && docker-compose -f docker-compose.dev.yml up -d

# Backend
cd d:\dev\iot-mesurable-server && npm run dev

# Frontend
cd d:\dev\iot-mesurable-nuxt-app && npm run dev

# DB Studio
cd d:\dev\iot-mesurable-server && npm run db:studio

# Flash ESP32
cd d:\dev\iot-mesurable-module-air-benchmark && pio run -t upload

# Monitor série
pio device monitor

# Écouter MQTT
mosquitto_sub -h localhost -t "#" -v
```

### DB
```bash
npm run db:generate    # Générer migration
npm run db:migrate     # Appliquer migration
npm run db:push        # Push direct (dev only)
npm run db:reset       # ⚠️ Reset complet
```

---

## 📝 Notes à garder en mémoire

*(Section mise à jour au fil du temps — ajouter ici les nouvelles découvertes)*
