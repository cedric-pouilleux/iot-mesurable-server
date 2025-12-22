"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
require("dotenv/config");
const zod_1 = require("zod");
const envSchema = zod_1.z.object({
    MQTT_BROKER: zod_1.z.string().default('mqtt://localhost'),
    POSTGRES_USER: zod_1.z.string().default('postgres'),
    DB_HOST: zod_1.z.string().default('localhost'),
    POSTGRES_PASSWORD: zod_1.z.string().default('password'),
    DB_PORT: zod_1.z.string().default('5432').transform(Number),
    POSTGRES_DB: zod_1.z.string().default('iot_data'),
    API_PORT: zod_1.z.string().default('3001').transform(Number),
});
const env = envSchema.parse(process.env);
exports.config = {
    mqtt: {
        broker: env.MQTT_BROKER,
    },
    db: {
        user: env.POSTGRES_USER,
        host: env.DB_HOST,
        password: env.POSTGRES_PASSWORD,
        port: env.DB_PORT,
        database: env.POSTGRES_DB,
        ssl: false,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
        allowExitOnIdle: false,
    },
    api: {
        port: env.API_PORT,
    },
};
