#!/bin/sh
set -e

echo "🚀 Démarrage du backend IoT..."

# Attendre que la base de données soit prête (max 30 tentatives)
echo "⏳ Attente de la base de données..."
MAX_RETRIES=30
RETRY_COUNT=0

until node -e "
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DB_HOST || 'timescaledb',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'password',
  database: process.env.POSTGRES_DB || 'iot_data',
  connectionTimeoutMillis: 2000,
});
pool.query('SELECT 1')
  .then(() => {
    console.log('✅ Base de données prête');
    pool.end();
    process.exit(0);
  })
  .catch((err) => {
    pool.end();
    process.exit(1);
  });
" 2>/dev/null; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "❌ Timeout: La base de données n'est pas accessible après $MAX_RETRIES tentatives"
    exit 1
  fi
  echo "⏳ Tentative $RETRY_COUNT/$MAX_RETRIES..."
  sleep 2
done

# Exécuter les migrations
echo "🔄 Application des migrations de base de données..."
node dist/scripts/run-migrations.js

# Démarrer le serveur
echo "🎯 Démarrage du serveur..."
exec node dist/server.js

