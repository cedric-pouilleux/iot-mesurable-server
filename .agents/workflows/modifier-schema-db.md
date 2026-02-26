---
description: Modifier le schéma de base de données avec Drizzle ORM
---

# Modifier le schéma DB

## Règles importantes

1. **Toujours** modifier `src/db/schema.ts` en premier
2. **Toujours** utiliser `snake_case` pour les noms de colonnes DB
3. **Toujours** utiliser le mapping explicite : `camelCase: type('snake_case')`
4. Utiliser `TIMESTAMPTZ` (pas `TIMESTAMP`) pour les dates

## Étapes

1. Modifier le schéma dans `src/db/schema.ts`

2. Générer la migration
```bash
npm run db:generate
```

3. Vérifier le fichier SQL généré dans `drizzle/`

4. Appliquer la migration
```bash
npm run db:migrate
```

5. Vérifier avec Drizzle Studio
```bash
npm run db:studio
```

## Option alternative : Push direct (dev only)
```bash
npm run db:push
```
⚠️ Ne pas utiliser en production, utiliser les migrations.

## Reset complet (dev only)
```bash
npm run db:reset
```
⚠️ Supprime TOUTES les données !

## Notes
- Après changement de schéma, penser à regénérer les types frontend :
  ```bash
  cd ../iot-mesurable-nuxt-app && npm run gen:api
  ```
- Les hypertables TimescaleDB nécessitent parfois des commandes SQL manuelles
