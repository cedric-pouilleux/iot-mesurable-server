import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  // Non-sensitive - defaults OK
  MQTT_BROKER: z.string().default('mqtt://localhost'),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.string().default('5432').transform(Number),
  API_PORT: z.string().default('3001').transform(Number),
  // Sensitive - no defaults, requires .env file
  DB_USER: z.string(),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string(),
})

const env = envSchema.parse(process.env)

export const config = {
  mqtt: {
    broker: env.MQTT_BROKER,
  },
  db: {
    user: env.DB_USER,
    host: env.DB_HOST,
    password: env.DB_PASSWORD,
    port: env.DB_PORT,
    database: env.DB_NAME,
    ssl: false,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    allowExitOnIdle: false,
  },
  api: {
    port: env.API_PORT,
  },
}
