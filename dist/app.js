"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildApp = buildApp;
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const swagger_1 = __importDefault(require("@fastify/swagger"));
const swagger_ui_1 = __importDefault(require("@fastify/swagger-ui"));
const sensible_1 = __importDefault(require("@fastify/sensible"));
const fastify_type_provider_zod_1 = require("fastify-type-provider-zod");
// Core
const registry_1 = require("./core/registry");
// Plugins
const db_1 = __importDefault(require("./plugins/db"));
const socket_1 = __importDefault(require("./plugins/socket"));
const mqtt_1 = __importDefault(require("./plugins/mqtt"));
const logger_1 = require("./lib/logger");
// Routes
const routes_1 = __importDefault(require("./modules/devices/routes"));
const routes_2 = __importDefault(require("./modules/system/routes"));
async function buildApp() {
    const app = (0, fastify_1.default)({
        logger: {
            stream: logger_1.dbLoggerStream,
            level: 'trace', // Allow all log levels to be processed
            customLevels: {
                success: 25,
            },
        },
        disableRequestLogging: true, // Disable automatic request logging (too verbose)
    }).withTypeProvider();
    // Validation
    app.setValidatorCompiler(fastify_type_provider_zod_1.validatorCompiler);
    app.setSerializerCompiler(fastify_type_provider_zod_1.serializerCompiler);
    // Sensible (HTTP Errors)
    await app.register(sensible_1.default);
    // CORS
    await app.register(cors_1.default, {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
    });
    // Swagger
    await app.register(swagger_1.default, {
        openapi: {
            info: {
                title: 'IoT Backend API',
                description: 'API for IoT Dashboard',
                version: '1.0.0',
            },
            servers: [],
        },
        transform: fastify_type_provider_zod_1.jsonSchemaTransform,
    });
    await app.register(swagger_ui_1.default, {
        routePrefix: '/documentation',
    });
    // Load module manifests (must be before MQTT for validation)
    await registry_1.registry.loadAll();
    // Core Plugins
    await app.register(db_1.default);
    await app.register(socket_1.default);
    await app.register(mqtt_1.default);
    // Import log retention plugin dynamically
    const logRetentionPlugin = await Promise.resolve().then(() => __importStar(require('./plugins/log-retention')));
    await app.register(logRetentionPlugin.default);
    // Routes
    await app.register(routes_1.default, { prefix: '/api' });
    await app.register(routes_2.default, { prefix: '/api' });
    // Module types routes (manifests)
    const moduleTypesRoutes = await Promise.resolve().then(() => __importStar(require('./modules/module-types/routes')));
    await app.register(moduleTypesRoutes.default, { prefix: '/api' });
    // Zones routes
    const zonesRoutes = await Promise.resolve().then(() => __importStar(require('./modules/zones/routes')));
    await app.register(zonesRoutes.default, { prefix: '/api' });
    // Import logs routes dynamically
    const logsRoutes = await Promise.resolve().then(() => __importStar(require('./modules/system/logs-routes')));
    await app.register(logsRoutes.default, { prefix: '/api' });
    app.get('/health', async () => {
        return { status: 'ok' };
    });
    return app;
}
