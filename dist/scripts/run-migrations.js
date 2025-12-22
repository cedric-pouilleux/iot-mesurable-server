"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const env_1 = require("../config/env");
const pool = new pg_1.Pool(env_1.config.db);
async function runMigrations() {
    const client = await pool.connect();
    try {
        console.log('🔄 Vérification des migrations...');
        // Créer la table de suivi des migrations si elle n'existe pas
        await client.query(`
      CREATE TABLE IF NOT EXISTS drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `);
        // Lire les fichiers de migration dans l'ordre
        // Depuis dist/scripts/, le dossier drizzle est à ../drizzle
        const drizzleDir = (0, path_1.join)(__dirname, '../../drizzle');
        const files = await (0, promises_1.readdir)(drizzleDir);
        const migrationFiles = files
            .filter(f => f.endsWith('.sql') && f.match(/^\d+_.+\.sql$/))
            .sort(); // Trier par nom (0000, 0001, etc.)
        console.log(`📦 ${migrationFiles.length} migration(s) trouvée(s)`);
        for (const file of migrationFiles) {
            // Vérifier si la migration a déjà été exécutée
            const fileHash = file;
            const result = await client.query('SELECT id FROM drizzle_migrations WHERE hash = $1', [fileHash]);
            if (result.rows.length > 0) {
                console.log(`⏭️  Migration ${file} déjà appliquée, ignorée`);
                continue;
            }
            console.log(`▶️  Application de la migration ${file}...`);
            const sqlPath = (0, path_1.join)(drizzleDir, file);
            const sql = await (0, promises_1.readFile)(sqlPath, 'utf-8');
            // Exécuter la migration dans une transaction
            await client.query('BEGIN');
            try {
                await client.query(sql);
                // Enregistrer la migration
                await client.query('INSERT INTO drizzle_migrations (hash, created_at) VALUES ($1, $2)', [fileHash, Date.now()]);
                await client.query('COMMIT');
                console.log(`✅ Migration ${file} appliquée avec succès`);
            }
            catch (err) {
                await client.query('ROLLBACK');
                throw err;
            }
        }
        console.log('✅ Toutes les migrations sont à jour');
    }
    catch (err) {
        console.error('❌ Erreur lors de l\'application des migrations:', err);
        process.exit(1);
    }
    finally {
        client.release();
        await pool.end();
    }
}
runMigrations();
