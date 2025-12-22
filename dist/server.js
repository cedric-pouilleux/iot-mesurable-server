"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const env_1 = require("./config/env");
const os_1 = __importDefault(require("os"));
function getNetworkInterfaces() {
    const interfaces = os_1.default.networkInterfaces();
    const results = [];
    for (const [name, addrs] of Object.entries(interfaces)) {
        if (!addrs)
            continue;
        for (const addr of addrs) {
            if (addr.family === 'IPv4' && !addr.internal) {
                let type = 'Network';
                if (addr.address.startsWith('192.168.') || addr.address.startsWith('10.')) {
                    type = 'LAN';
                }
                else if (addr.address.startsWith('172.')) {
                    type = 'WSL/Docker';
                }
                results.push({ ip: addr.address, type });
            }
        }
    }
    return results;
}
async function start() {
    const app = await (0, app_1.buildApp)();
    try {
        // Disable Fastify's automatic listening logs by using a custom listener
        await app.listen({ port: env_1.config.api.port, host: '0.0.0.0' });
        // Log startup with custom messages
        app.log.success({
            msg: `✓ Server listening on localhost:${env_1.config.api.port}`,
            interface: 'Localhost',
            url: `http://localhost:${env_1.config.api.port}`,
        });
        // Log each network interface
        const interfaces = getNetworkInterfaces();
        for (const iface of interfaces) {
            app.log.success({
                msg: `✓ Server listening on ${iface.ip}:${env_1.config.api.port} (${iface.type})`,
                interface: iface.type,
                url: `http://${iface.ip}:${env_1.config.api.port}`,
            });
        }
        console.log(`🚀 Server running at http://localhost:${env_1.config.api.port}`);
        console.log(`📚 Documentation at http://localhost:${env_1.config.api.port}/documentation`);
    }
    catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}
start();
