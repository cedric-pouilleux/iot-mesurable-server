"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemController = void 0;
const systemRepository_1 = require("./systemRepository");
class SystemController {
    fastify;
    systemRepo;
    constructor(fastify) {
        this.fastify = fastify;
        this.systemRepo = new systemRepository_1.SystemRepository(fastify.db);
    }
    getDbSize = async (req, reply) => {
        try {
            const row = await this.systemRepo.getDbSize();
            const response = {
                totalSize: row.total_size,
                totalSizeBytes: parseInt(row.total_size_bytes, 10),
            };
            return response;
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            this.fastify.log.error(err);
            throw this.fastify.httpErrors.internalServerError(errorMessage);
        }
    };
    getMetricsHistory = async (req, reply) => {
        const { days } = req.query;
        try {
            const rows = await this.systemRepo.getMetricsHistory(days);
            const history = rows.map(row => ({
                time: row.time instanceof Date ? row.time : new Date(row.time),
                codeSizeKb: row.code_size_kb,
                dbSizeBytes: row.db_size_bytes,
            }));
            const response = {
                history: history,
                count: history.length,
                periodDays: days,
            };
            return response;
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            this.fastify.log.error(err);
            throw this.fastify.httpErrors.internalServerError(errorMessage);
        }
    };
}
exports.SystemController = SystemController;
