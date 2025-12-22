"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const controller_1 = require("./controller");
const schema_1 = require("./schema");
const systemRoutes = async (fastify) => {
    const app = fastify.withTypeProvider();
    const controller = new controller_1.SystemController(fastify);
    // GET /db-size
    app.get('/db-size', {
        schema: {
            tags: ['System'],
            summary: 'Get database size',
            response: {
                200: schema_1.DbSizeResponseSchema,
            },
        },
    }, controller.getDbSize);
    // GET /metrics-history
    app.get('/metrics-history', {
        schema: {
            tags: ['System'],
            summary: 'Get system metrics history',
            querystring: schema_1.MetricsHistoryQuerySchema,
            response: {
                200: schema_1.MetricsHistoryResponseSchema,
            },
        },
    }, controller.getMetricsHistory);
};
exports.default = systemRoutes;
