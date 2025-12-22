"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const socket_io_1 = require("socket.io");
exports.default = (0, fastify_plugin_1.default)(async (fastify) => {
    const io = new socket_io_1.Server(fastify.server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
        },
        pingTimeout: 60000,
        pingInterval: 25000,
    });
    let connectedClients = 0;
    io.on('connection', (socket) => {
        connectedClients++;
        const clientInfo = {
            id: socket.id,
            ip: socket.handshake.address,
            userAgent: socket.handshake.headers['user-agent'] || 'unknown',
            transport: socket.conn.transport.name,
        };
        fastify.log.success({
            msg: `[WEBSOCKET] Client connected (${clientInfo.ip})`,
            source: 'USER',
            socketId: clientInfo.id,
            ip: clientInfo.ip,
            userAgent: clientInfo.userAgent,
            transport: clientInfo.transport,
            totalClients: connectedClients,
        });
        socket.on('disconnect', (reason) => {
            connectedClients = Math.max(0, connectedClients - 1);
            fastify.log.info({
                msg: '[WEBSOCKET] Client disconnected',
                source: 'USER',
                socketId: clientInfo.id,
                reason,
                totalClients: connectedClients,
            });
        });
        socket.on('error', (error) => {
            fastify.log.error({
                msg: '[WEBSOCKET] Socket error',
                socketId: clientInfo.id,
                error: error.message,
                stack: error.stack,
            });
        });
        socket.on('connect_error', (error) => {
            fastify.log.error({
                msg: '[WEBSOCKET] Connection error',
                socketId: clientInfo.id,
                error: error.message,
            });
        });
    });
    io.engine.on('connection_error', (err) => {
        fastify.log.error({
            msg: '[WEBSOCKET] Engine connection error',
            error: err.message,
            stack: err.stack,
        });
    });
    fastify.decorate('io', io);
    fastify.addHook('onClose', (instance, done) => {
        fastify.log.info({
            msg: '[WEBSOCKET] Closing Socket.IO server',
            connectedClients,
        });
        instance.io.close();
        done();
    });
});
