"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const client_1 = require("../db/client");
exports.default = (0, fastify_plugin_1.default)(async (fastify) => {
    try {
        // Check connection
        const result = await client_1.pool.query('SELECT version(), current_database()');
        const version = result.rows[0]?.version || 'Unknown';
        const database = result.rows[0]?.current_database || 'Unknown';
        fastify.log.success({
            msg: `✓ [DB] Connected to PostgreSQL`,
            database,
            host: client_1.pool.options.host,
            port: client_1.pool.options.port,
            version: version.split(' ')[0], // Just "PostgreSQL 14.x"
        });
    }
    catch (err) {
        fastify.log.error({ msg: '[DB] Connection failed', error: err });
        throw err;
    }
    fastify.decorate('db', client_1.db);
    fastify.decorate('pg', client_1.pool);
    fastify.addHook('onClose', async (instance) => {
        await instance.pg.end();
        instance.log.info('Database connection closed');
    });
});
