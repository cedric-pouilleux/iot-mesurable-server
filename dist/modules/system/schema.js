"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsHistoryResponseSchema = exports.DbSizeResponseSchema = exports.MetricsHistoryQuerySchema = void 0;
const zod_1 = require("zod");
exports.MetricsHistoryQuerySchema = zod_1.z.object({
    days: zod_1.z.string().default('30').transform(Number),
});
exports.DbSizeResponseSchema = zod_1.z.object({
    totalSize: zod_1.z.string(),
    totalSizeBytes: zod_1.z.number(),
});
exports.MetricsHistoryResponseSchema = zod_1.z.object({
    history: zod_1.z.array(zod_1.z.object({
        time: zod_1.z.string().or(zod_1.z.date()),
        codeSizeKb: zod_1.z.number().nullable(),
        dbSizeBytes: zod_1.z.string().or(zod_1.z.number()),
    })),
    count: zod_1.z.number(),
    periodDays: zod_1.z.number(),
});
