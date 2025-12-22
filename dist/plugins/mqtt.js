"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const mqtt_1 = __importDefault(require("mqtt"));
const env_1 = require("../config/env");
const mqttRepository_1 = require("../modules/mqtt/mqttRepository");
const mqttMessageHandler_1 = require("../modules/mqtt/mqttMessageHandler");
exports.default = (0, fastify_plugin_1.default)(async (fastify) => {
    const client = mqtt_1.default.connect(env_1.config.mqtt.broker);
    const mqttRepo = new mqttRepository_1.MqttRepository(fastify.db);
    // --- BUFFERING SYSTEM ---
    const measurementBuffer = [];
    const statusUpdateBuffer = [];
    const FLUSH_INTERVAL = 5000;
    async function flushMeasurements() {
        if (measurementBuffer.length === 0) {
            return;
        }
        const batch = [...measurementBuffer];
        measurementBuffer.length = 0;
        // Group by device for better logging
        const byDevice = batch.reduce((acc, m) => {
            if (!acc[m.moduleId])
                acc[m.moduleId] = [];
            acc[m.moduleId].push(m);
            return acc;
        }, {});
        const deviceSummaries = Object.entries(byDevice).map(([moduleId, measurements]) => {
            const sensors = measurements.map(m => `${m.sensorType}=${m.value}`).join(', ');
            return `${moduleId} (${measurements.length}: ${sensors})`;
        });
        try {
            await mqttRepo.insertMeasurementsBatch(batch);
            const deviceList = Object.entries(byDevice)
                .map(([id, m]) => `${id}(${m.length})`)
                .join(', ');
            fastify.log.info({
                msg: `[DB] Inserted ${batch.length} measurements: ${deviceList}`,
                count: batch.length,
                devices: Object.keys(byDevice),
                deviceCounts: Object.fromEntries(Object.entries(byDevice).map(([id, m]) => [id, m.length])),
            });
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            fastify.log.error({
                msg: `[DB] Batch insert failed: ${errorMessage}`,
                error: errorMessage,
                count: batch.length,
            });
            // Remettre les mesures dans le buffer en cas d'erreur (pour réessayer plus tard)
            measurementBuffer.unshift(...batch);
        }
    }
    async function flushStatusUpdates() {
        if (statusUpdateBuffer.length === 0)
            return;
        const batch = [...statusUpdateBuffer];
        statusUpdateBuffer.length = 0;
        for (const update of batch) {
            try {
                await handleDeviceStatusUpdate(mqttRepo, update);
            }
            catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                fastify.log.error(`❌ Status Update Error: ${errorMessage}`);
            }
        }
    }
    // Flush périodique toutes les 5 secondes
    setInterval(() => {
        void flushMeasurements();
    }, FLUSH_INTERVAL);
    // Flush des status updates toutes les 2.5 secondes
    setInterval(() => {
        void flushStatusUpdates();
    }, FLUSH_INTERVAL / 2);
    client.on('connect', () => {
        const subscribedTopics = ['#']; // We subscribe to all topics
        client.subscribe('#', err => {
            if (err) {
                fastify.log.error({ msg: '[MQTT] Subscription failed', error: err });
            }
            else {
                fastify.log.success({
                    msg: '✓ [MQTT] Connected to broker and subscribed',
                    broker: env_1.config.mqtt.broker,
                    topics: subscribedTopics,
                    wildcardSubscription: true,
                });
            }
        });
        republishAllConfigs(fastify, mqttRepo);
    });
    client.on('error', err => {
        fastify.log.error({
            msg: '[MQTT] Connection error',
            error: err.message,
            broker: env_1.config.mqtt.broker,
        });
    });
    const messageHandler = new mqttMessageHandler_1.MqttMessageHandler(fastify, mqttRepo, measurementBuffer, statusUpdateBuffer, async () => {
        await flushStatusUpdates();
    }, async () => {
        await flushMeasurements();
    });
    client.on('message', async (topic, message) => {
        await messageHandler.handleMessage(topic, message);
    });
    fastify.decorate('mqtt', client);
    fastify.decorate('publishConfig', (moduleId, config) => {
        if (!client)
            return false;
        const topic = `${moduleId}/sensors/config`;
        const payload = JSON.stringify(config);
        client.publish(topic, payload, { retain: true, qos: 1 });
        return true;
    });
    fastify.decorate('publishReset', (moduleId, sensor) => {
        if (!client)
            return false;
        const topic = `${moduleId}/sensors/reset`;
        const payload = JSON.stringify({ sensor });
        client.publish(topic, payload, { qos: 1 });
        fastify.log.success({
            msg: `✓ [MQTT] Reset sent to ${moduleId}: ${sensor}`,
            direction: 'OUT',
            moduleId,
            sensor
        });
        return true;
    });
    fastify.addHook('onClose', (instance, done) => {
        flushMeasurements();
        flushStatusUpdates();
        client.end();
        done();
    });
});
async function handleDeviceStatusUpdate(mqttRepo, update) {
    const { moduleId, type, data } = update;
    switch (type) {
        case 'system':
            await mqttRepo.updateSystemStatus(moduleId, data);
            break;
        case 'system_config':
            await mqttRepo.updateSystemConfig(moduleId, data);
            break;
        case 'sensors_status':
            await mqttRepo.updateSensorStatus(moduleId, data);
            break;
        case 'sensors_config':
            await mqttRepo.updateSensorConfig(moduleId, data);
            break;
        case 'hardware':
            await mqttRepo.updateHardware(moduleId, data);
            break;
    }
}
async function republishAllConfigs(fastify, mqttRepo) {
    try {
        const configsByModule = await mqttRepo.getEnabledSensorConfigs();
        // Publish configs
        for (const [moduleId, config] of Object.entries(configsByModule)) {
            fastify.publishConfig(moduleId, config);
        }
        const moduleIds = Object.keys(configsByModule);
        fastify.log.info({
            msg: `[MQTT] Republished configs for ${moduleIds.length} modules: ${moduleIds.join(', ')}`,
            count: moduleIds.length,
            modules: moduleIds,
        });
    }
    catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        fastify.log.error({
            msg: '[MQTT] Error republishing configs',
            error: errorMessage,
        });
    }
}
