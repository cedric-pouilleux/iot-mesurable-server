"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const controller_1 = require("./controller");
const schema_1 = require("./schema");
const devicesRoutes = async (fastify) => {
    const app = fastify.withTypeProvider();
    const controller = new controller_1.DeviceController(fastify);
    // GET /modules - List all modules
    app.get('/modules', {
        schema: {
            tags: ['Devices'],
            summary: 'List all modules',
            response: {
                200: schema_1.ModuleListResponseSchema,
            },
        },
    }, controller.listModules);
    // POST /modules/:id/config - Update module configuration
    app.post('/modules/:id/config', {
        schema: {
            tags: ['Devices'],
            summary: 'Update module sensor configuration',
            params: schema_1.ModuleParamsSchema,
            body: schema_1.ModuleConfigSchema,
            response: {
                200: schema_1.ConfigUpdateResponseSchema,
            },
        },
    }, controller.updateConfig);
    // POST /modules/:id/reset-sensor - Reset a specific sensor
    app.post('/modules/:id/reset-sensor', {
        schema: {
            tags: ['Devices'],
            summary: 'Reset a specific sensor',
            params: schema_1.ModuleParamsSchema,
            body: schema_1.SensorResetSchema,
            response: {
                200: schema_1.ConfigUpdateResponseSchema,
            },
        },
    }, controller.resetSensor);
    // PATCH /modules/:id/preferences - Update module preferences
    app.patch('/modules/:id/preferences', {
        schema: {
            tags: ['Devices'],
            summary: 'Update module preferences',
            params: schema_1.ModuleParamsSchema,
            body: schema_1.PreferencesSchema,
            response: {
                200: schema_1.UpdatePreferencesResponseSchema,
            },
        },
    }, controller.updatePreferences);
    // DELETE /modules/:id/zone - Remove device from zone
    app.delete('/modules/:id/zone', {
        schema: {
            tags: ['Devices'],
            summary: 'Remove device from its zone',
            params: schema_1.ModuleParamsSchema,
            response: {
                200: schema_1.ConfigUpdateResponseSchema,
            },
        },
    }, controller.removeFromZone);
    // GET /modules/:id/status - Get module status only
    app.get('/modules/:id/status', {
        schema: {
            tags: ['Devices'],
            summary: 'Get module status (system, hardware, sensors config)',
            params: schema_1.ModuleParamsSchema,
            response: {
                200: schema_1.ModuleStatusResponseSchema,
            },
        },
    }, controller.getModuleStatus);
    // GET /modules/:id/history - Get historical sensor data only
    app.get('/modules/:id/history', {
        schema: {
            tags: ['Devices'],
            summary: 'Get historical sensor data',
            params: schema_1.ModuleParamsSchema,
            querystring: schema_1.ModuleHistoryQuerySchema,
            response: {
                200: schema_1.ModuleHistoryResponseSchema,
            },
        },
    }, controller.getModuleHistory);
    // GET /modules/:id/storage - Get module storage stats
    app.get('/modules/:id/storage', {
        schema: {
            tags: ['Devices'],
            summary: 'Get module storage statistics and projections',
            params: schema_1.ModuleParamsSchema,
            response: {
                200: schema_1.ModuleStorageResponseSchema,
            },
        },
    }, controller.getModuleStorage);
    // GET /modules/:id/data - Legacy: Get module status and time series (kept for compatibility)
    app.get('/modules/:id/data', {
        schema: {
            tags: ['Devices'],
            summary: '[Legacy] Get module status and time series measurements',
            params: schema_1.ModuleParamsSchema,
            querystring: schema_1.ModuleDataQuerySchema,
            response: {
                200: schema_1.ModuleDataResponseSchema,
            },
        },
    }, controller.getModuleData);
};
exports.default = devicesRoutes;
