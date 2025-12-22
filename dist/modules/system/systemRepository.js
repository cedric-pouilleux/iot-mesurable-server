"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemRepository = void 0;
const drizzle_orm_1 = require("drizzle-orm");
class SystemRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async getDbSize() {
        const result = await this.db.execute((0, drizzle_orm_1.sql) `
            SELECT pg_size_pretty(pg_database_size(current_database())) as total_size,
                   pg_database_size(current_database()) as total_size_bytes
        `);
        return result.rows[0];
    }
    async getMetricsHistory(days) {
        const result = await this.db.execute((0, drizzle_orm_1.sql) `
            SELECT 
                time,
                code_size_kb,
                db_size_bytes
            FROM system_metrics
            WHERE time > NOW() - (${days} || ' days')::interval
            ORDER BY time ASC
        `);
        return result.rows;
    }
}
exports.SystemRepository = SystemRepository;
