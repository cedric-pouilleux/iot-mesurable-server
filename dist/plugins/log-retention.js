"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const client_1 = require("../db/client");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
exports.default = (0, fastify_plugin_1.default)(async (fastify) => {
    try {
        // Read and execute retention policy SQL
        const retentionSQL = await promises_1.default.readFile(path_1.default.join(__dirname, '../db/retention.sql'), 'utf-8');
        await client_1.pool.query(retentionSQL);
        // Silent success - no need to log this every startup
    }
    catch (err) {
        fastify.log.error({ msg: '[SYSTEM] Failed to apply log retention policy', error: err });
    }
});
