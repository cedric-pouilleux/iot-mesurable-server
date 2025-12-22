"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("../../db/schema");
const LogsQuerySchema = zod_1.z.object({
    category: zod_1.z.union([
        zod_1.z.enum(['HARDWARE', 'MQTT', 'DB', 'API', 'WEBSOCKET']),
        zod_1.z.array(zod_1.z.enum(['HARDWARE', 'MQTT', 'DB', 'API', 'WEBSOCKET']))
    ]).optional(),
    source: zod_1.z.enum(['SYSTEM', 'USER']).optional(),
    direction: zod_1.z.enum(['IN', 'OUT']).optional(),
    moduleId: zod_1.z.string().optional(),
    level: zod_1.z.union([
        zod_1.z.enum(['trace', 'success', 'info', 'warn', 'error', 'fatal']),
        zod_1.z.array(zod_1.z.enum(['trace', 'success', 'info', 'warn', 'error', 'fatal']))
    ]).optional(),
    search: zod_1.z.string().optional(),
    startDate: zod_1.z.string().datetime().optional(),
    endDate: zod_1.z.string().datetime().optional(),
    limit: zod_1.z.string().transform(Number).pipe(zod_1.z.number().int().min(1).max(1000)).default('100'),
    offset: zod_1.z.string().transform(Number).pipe(zod_1.z.number().int().min(0)).default('0'),
});
const LogEntrySchema = zod_1.z.object({
    id: zod_1.z.string(),
    category: zod_1.z.string(),
    source: zod_1.z.string(),
    direction: zod_1.z.string().nullable(),
    level: zod_1.z.string(),
    msg: zod_1.z.string(),
    time: zod_1.z.date(),
    details: zod_1.z.record(zod_1.z.unknown()).nullable(),
});
const LogsResponseSchema = zod_1.z.object({
    logs: zod_1.z.array(LogEntrySchema),
    total: zod_1.z.number(),
    limit: zod_1.z.number(),
    offset: zod_1.z.number(),
});
const logsRoutes = async (fastify) => {
    const app = fastify.withTypeProvider();
    app.get('/logs', {
        schema: {
            tags: ['System'],
            summary: 'Get system logs with filtering',
            querystring: LogsQuerySchema,
            response: {
                200: LogsResponseSchema,
            },
        },
    }, async (request, reply) => {
        const { category, source, direction, moduleId, level, search, startDate, endDate, limit, offset } = request.query;
        // Build conditions
        const conditions = [];
        if (category) {
            const cats = Array.isArray(category) ? [...category] : [category];
            if (cats.includes('HARDWARE') && !cats.includes('ESP32'))
                cats.push('ESP32');
            if (cats.length > 0) {
                conditions.push((0, drizzle_orm_1.inArray)(schema_1.systemLogs.category, cats));
            }
        }
        if (source) {
            conditions.push((0, drizzle_orm_1.eq)(schema_1.systemLogs.source, source));
        }
        if (direction) {
            conditions.push((0, drizzle_orm_1.eq)(schema_1.systemLogs.direction, direction));
        }
        if (moduleId) {
            conditions.push((0, drizzle_orm_1.sql) `${schema_1.systemLogs.details}->>'moduleId' = ${moduleId}`);
        }
        if (level) {
            const lvls = Array.isArray(level) ? level : [level];
            if (lvls.length > 0) {
                conditions.push((0, drizzle_orm_1.inArray)(schema_1.systemLogs.level, lvls));
            }
        }
        if (search) {
            conditions.push((0, drizzle_orm_1.or)((0, drizzle_orm_1.like)(schema_1.systemLogs.msg, `%${search}%`), (0, drizzle_orm_1.like)(schema_1.systemLogs.level, `%${search}%`), (0, drizzle_orm_1.sql) `${schema_1.systemLogs.details}::text ILIKE ${'%' + search + '%'}`));
        }
        if (startDate) {
            conditions.push((0, drizzle_orm_1.gte)(schema_1.systemLogs.time, new Date(startDate)));
        }
        if (endDate) {
            conditions.push((0, drizzle_orm_1.lte)(schema_1.systemLogs.time, new Date(endDate)));
        }
        // Get logs
        const logsResult = await fastify.db
            .select()
            .from(schema_1.systemLogs)
            .where(conditions.length > 0 ? (0, drizzle_orm_1.and)(...conditions) : undefined)
            .orderBy((0, drizzle_orm_1.desc)(schema_1.systemLogs.time))
            .limit(limit)
            .offset(offset);
        // Cast details to proper type
        const logs = logsResult.map(log => ({
            ...log,
            details: log.details,
        }));
        // Get total count
        const totalResult = await fastify.db
            .select({ count: schema_1.systemLogs.id })
            .from(schema_1.systemLogs)
            .where(conditions.length > 0 ? (0, drizzle_orm_1.and)(...conditions) : undefined);
        return {
            logs,
            total: totalResult.length,
            limit,
            offset,
        };
    });
    // Histogram endpoint
    app.get('/logs/histogram', {
        schema: {
            tags: ['System'],
            summary: 'Get system logs histogram data',
            querystring: zod_1.z.object({
                date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
                startDate: zod_1.z.string().datetime().optional(),
                endDate: zod_1.z.string().datetime().optional(),
                category: zod_1.z.union([
                    zod_1.z.enum(['HARDWARE', 'MQTT', 'DB', 'API', 'SYSTEM', 'WEBSOCKET']),
                    zod_1.z.array(zod_1.z.enum(['HARDWARE', 'MQTT', 'DB', 'API', 'SYSTEM', 'WEBSOCKET']))
                ]).optional(),
                level: zod_1.z.union([
                    zod_1.z.enum(['trace', 'debug', 'success', 'info', 'warn', 'error', 'fatal']),
                    zod_1.z.array(zod_1.z.enum(['trace', 'debug', 'success', 'info', 'warn', 'error', 'fatal']))
                ]).optional(),
                search: zod_1.z.string().optional(),
            }),
            response: {
                200: zod_1.z.array(zod_1.z.object({
                    slot: zod_1.z.string(), // ISO timestamp of the bucket start
                    counts: zod_1.z.record(zod_1.z.number()), // category -> count
                })),
            },
        },
    }, async (request, reply) => {
        const { date, startDate: queryStartDate, endDate: queryEndDate, category, level, search } = request.query;
        let start;
        let end;
        if (date) {
            start = new Date(date);
            start.setHours(0, 0, 0, 0);
            end = new Date(date);
            end.setHours(23, 59, 59, 999);
        }
        else if (queryStartDate && queryEndDate) {
            start = new Date(queryStartDate);
            end = new Date(queryEndDate);
        }
        else {
            // Default to last 24h
            end = new Date();
            start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
        }
        // Fixed 10-minute buckets as requested
        const bucketSizeSeconds = 600;
        let query = (0, drizzle_orm_1.sql) `
        SELECT
          floor(extract(epoch from time) / ${bucketSizeSeconds}) * ${bucketSizeSeconds} as bucket,
          category,
          count(*) as count
        FROM system_logs
        WHERE time >= ${start.toISOString()} AND time <= ${end.toISOString()}
      `;
        if (category) {
            const cats = Array.isArray(category) ? [...category] : [category];
            if (cats.includes('HARDWARE') && !cats.includes('ESP32'))
                cats.push('ESP32');
            if (cats.length > 0) {
                query = (0, drizzle_orm_1.sql) `${query} AND category IN ${cats}`;
            }
        }
        if (level) {
            const lvls = Array.isArray(level) ? level : [level];
            if (lvls.length > 0) {
                query = (0, drizzle_orm_1.sql) `${query} AND level IN ${lvls}`;
            }
        }
        if (search) {
            query = (0, drizzle_orm_1.sql) `${query} AND (
          msg ILIKE ${`%${search}%`} 
          OR level ILIKE ${`%${search}%`}
          OR details::text ILIKE ${`%${search}%`}
        )`;
        }
        query = (0, drizzle_orm_1.sql) `${query} GROUP BY bucket, category ORDER BY bucket ASC`;
        const result = await fastify.db.execute(query);
        // Process result into slots
        const buckets = {};
        // Generate all slots between start and end
        const slotMs = bucketSizeSeconds * 1000;
        for (let time = start.getTime(); time <= end.getTime(); time += slotMs) {
            const slotDate = new Date(time);
            buckets[slotDate.toISOString()] = {};
        }
        // Fill in counts from query
        for (const row of result.rows) {
            const bucketTime = new Date(Number(row.bucket) * 1000);
            const slotKey = bucketTime.toISOString();
            if (!buckets[slotKey]) {
                buckets[slotKey] = {};
            }
            buckets[slotKey][row.category] = Number(row.count);
        }
        // Convert to array
        const slots = Object.entries(buckets)
            .map(([slot, counts]) => ({
            slot,
            counts,
        }))
            .sort((a, b) => new Date(a.slot).getTime() - new Date(b.slot).getTime());
        return slots;
    });
    // Delete all logs
    app.delete('/logs', {
        schema: {
            tags: ['System'],
            summary: 'Delete all system logs',
            response: {
                200: zod_1.z.object({
                    message: zod_1.z.string(),
                    deletedCount: zod_1.z.number(),
                }),
            },
        },
    }, async (request, reply) => {
        const result = await fastify.db.delete(schema_1.systemLogs);
        return {
            message: 'All logs deleted successfully',
            deletedCount: 0, // Drizzle doesn't return count for delete
        };
    });
};
exports.default = logsRoutes;
