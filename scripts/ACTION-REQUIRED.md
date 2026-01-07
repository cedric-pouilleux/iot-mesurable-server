# Actions Requises - Base de Données Vide

## Problème
Après la migration qui a ajouté `chipId`, toutes les tables ont été vidées (TRUNCATE).
La base de données ne contient plus:
- ❌ Aucun module
- ❌ Aucune sensor config
- ❌ Aucune sensor status
- ❌ Aucune mesure

## Solution Immédiate

### 1. Redémarrer les modules ESP32

**Sans le firmware mis à jour (ancien firmware):**
- ⚠️ Les modules vont publier SANS chipId
- ⚠️ Le serveur va utiliser chipId='UNKNOWN' comme fallback
- ✅ Les données vont s'enregistrer en BDD
- ⚠️ MAIS si vous avez 2 modules avec le même nom, ils vont encore se mélanger!

**Avec le firmware mis à jour (nouveau):**
- ✅ Les modules vont publier AVEC chipId
- ✅ Le serveur va enregistrer le vrai chipId
- ✅ Plus de confusion possible entre modules

### 2. Actions

**Option A - Redémarrage rapide (firmware actuel):**
```bash
# Appuyez sur RESET sur chaque ESP32
# ou débranchez/rebranchez
```
✅ Les modules vont immédiatement republier
✅ Les données vont apparaître dans l'UI
⚠️ Utilisera chipId='UNKNOWN'

**Option B - Flash du nouveau firmware d'abord (recommandé):**
```bash
cd d:\dev-iot\iot-mesurable-module-air
pio run --target upload

cd d:\dev-iot\iot-mesurable-module-air-benchmark  
pio run --target upload
```
✅ Les modules auront le vrai chipId
✅ Protection contre les doublons

## Vérification

Monitorer les messages MQTT:
```bash
cd d:\dev-iot\iot-mesurable-ecosystem\iot-mesurable-server
npx tsx scripts/monitor-mqtt.ts
```

Cherchez dans les messages `system/config`:
```json
{
  "chipId": "A0B1C2D3E4F50607",  // ← Doit apparaître!
  "ip": "...",
  "mac": "...",
  ...
}
```

## Notes

- Les queries `getSensorStatus()` et `getSensorConfig()` sont correctes
- Elles filtrent par moduleId (qui retourne tous les chipId pour ce moduleId)
- Une fois les données republiées, tout fonctionnera normalement
