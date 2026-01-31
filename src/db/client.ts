import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema'
import { config } from '../config/env'

export const pool = new Pool(config.db)
export const db = drizzle(pool, { schema })
