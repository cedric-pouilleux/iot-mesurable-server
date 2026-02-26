---
description: Débugger les problèmes de communication MQTT
---

# Débugger MQTT

## Outils

### Écouter tous les messages MQTT
```bash
mosquitto_sub -h localhost -t "#" -v
```

### Écouter un module spécifique
```bash
mosquitto_sub -h localhost -t "croissance/#" -v
```

### Publier un message de test
```bash
mosquitto_pub -h localhost -t "test-module/dht22/temperature" -m "22.5"
```

## Problèmes courants

### Le module n'apparaît pas
1. Vérifier que le module est connecté au WiFi (moniteur série)
2. Vérifier que le broker MQTT tourne : `docker-compose ps`
3. Vérifier l'IP du broker dans `secrets.h`
4. Écouter les messages : `mosquitto_sub -h localhost -t "#" -v`

### Les données n'arrivent pas au dashboard
1. Vérifier les messages MQTT arrivent au broker
2. Vérifier les logs backend : `docker-compose logs -f backend`
3. Vérifier le buffer : les données sont insérées par batch (toutes les 5s)
4. Vérifier la DB : `npm run db:studio`

### Données en double ou manquantes
- Le server utilise `onConflictDoUpdate` pour éviter les doublons
- Les valeurs vides/invalides sont normalisées en `null`
- Vérifier le `chipId` — les entrées "UNKNOWN" sont filtrées

### Déconnexion WiFi → perte de données
- Actuellement pas de buffer local sur l'ESP32
- Les données pendant la déconnexion sont perdues
- La reconnexion est automatique (lib bootstrap)
