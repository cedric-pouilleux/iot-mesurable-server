// Script Node.js pour réinitialiser complètement la base de données
const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')
require('dotenv').config()

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'iot_data',
})

async function resetDatabase() {
  const client = await pool.connect()
  
  try {
    console.log('🔧 Connexion à la base de données...')
    
    // Lire le script SQL
    const sqlPath = path.join(__dirname, 'reset-database.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')
    
    console.log('📦 Exécution du script SQL (suppression et recréation)...')
    await client.query(sql)
    
    console.log('✅ Base de données réinitialisée avec succès!')
    
    // Vérifier les tables créées
    const result = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `)
    
    console.log('\n📊 Tables créées:')
    result.rows.forEach(row => {
      console.log(`   - ${row.tablename}`)
    })
    
    // Vérifier TimescaleDB
    try {
      const hypertableCheck = await client.query(`
        SELECT EXISTS(
          SELECT 1 FROM timescaledb_information.hypertables 
          WHERE hypertable_name = 'measurements'
        ) as is_hypertable
      `)
      
      if (hypertableCheck.rows[0].is_hypertable) {
        console.log('\n✅ TimescaleDB hypertable configurée pour measurements')
      }
    } catch (e) {
      console.log('\n⚠️  TimescaleDB non configuré (normal si extension non installée)')
    }
    
  } catch (err) {
    console.error('❌ Erreur:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

resetDatabase()







