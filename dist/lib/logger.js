"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbLoggerStream = void 0;
exports.stopLogger = stopLogger;
const stream_1 = require("stream");
const client_1 = require("../db/client");
const schema_1 = require("../db/schema");
const levelMap = {
    10: 'trace',
    20: 'debug',
    25: 'success',
    30: 'info',
    40: 'warn',
    50: 'error',
    60: 'fatal',
};
const logBuffer = [];
const FLUSH_INTERVAL_MS = 5000; // Flush every 5 seconds
const MAX_BUFFER_SIZE = 100; // Or when buffer reaches 100 entries
let flushTimer = null;
/**
 * Flush buffered logs to database in a single batch insert
 */
async function flushLogs() {
    if (logBuffer.length === 0)
        return;
    const logsToInsert = logBuffer.splice(0, logBuffer.length);
    try {
        await client_1.db.insert(schema_1.systemLogs).values(logsToInsert);
    }
    catch (err) {
        process.stderr.write(`Failed to batch insert logs: ${err.message}\n`);
    }
}
/**
 * Start the flush timer
 */
function startFlushTimer() {
    if (flushTimer)
        return;
    flushTimer = setInterval(flushLogs, FLUSH_INTERVAL_MS);
    // Don't block process exit
    flushTimer.unref();
}
/**
 * Stop the flush timer and flush remaining logs
 */
async function stopLogger() {
    if (flushTimer) {
        clearInterval(flushTimer);
        flushTimer = null;
    }
    await flushLogs();
}
// ============================================================================
// Writable Stream for Fastify
// ============================================================================
exports.dbLoggerStream = new stream_1.Writable({
    write(chunk, encoding, callback) {
        const logEntry = chunk.toString();
        try {
            const parsed = JSON.parse(logEntry);
            const { level, msg, time, source, direction, ...details } = parsed;
            const levelStr = typeof level === 'number' ? levelMap[level] || String(level) : String(level);
            // Extract category from message prefix
            let category = '';
            let cleanMsg = msg || '';
            // Filter out generic Fastify logs (not useful)
            if (cleanMsg === 'incoming request' ||
                cleanMsg === 'request completed' ||
                cleanMsg.startsWith('Server listening at')) {
                callback();
                return;
            }
            // Match [CATEGORY] or [CATEGORY:extra] format
            const categoryMatch = cleanMsg.match(/^\[([A-Z0-9]+)(?::[^\]]+)?\]\s*/);
            if (categoryMatch) {
                category = categoryMatch[1];
                cleanMsg = cleanMsg.replace(/^\[[A-Z0-9]+(?::[^\]]+)?\]\s*/, '');
            }
            else {
                // Skip logs without a category prefix (they would have been SYSTEM)
                callback();
                return;
            }
            // Add to buffer instead of immediate insert
            logBuffer.push({
                category,
                source: source || 'SYSTEM', // Default to SYSTEM if not specified
                direction: direction || null, // IN, OUT, or null
                level: levelStr,
                msg: cleanMsg,
                time: new Date(time || Date.now()),
                details: details,
            });
            // Start timer on first log
            startFlushTimer();
            // Force flush if buffer is full
            if (logBuffer.length >= MAX_BUFFER_SIZE) {
                flushLogs();
            }
            callback();
        }
        catch (err) {
            process.stderr.write(`Failed to parse log entry: ${err}\n`);
            callback();
        }
    },
});
