"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const drizzle_orm_1 = require("drizzle-orm");
const schema = __importStar(require("../../db/schema"));
/**
 * Zones Routes
 *
 * CRUD operations for zones (physical locations that group devices).
 */
// Schemas
const ZoneSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string(),
    description: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string().nullable()
});
const ZoneListSchema = zod_1.z.array(ZoneSchema);
const CreateZoneSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required'),
    description: zod_1.z.string().optional().nullable()
});
const UpdateZoneSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required'),
    description: zod_1.z.string().optional().nullable()
});
const ZoneParamsSchema = zod_1.z.object({
    id: zod_1.z.string().uuid()
});
const DeviceInZoneSchema = zod_1.z.object({
    moduleId: zod_1.z.string(),
    name: zod_1.z.string().nullable(),
    moduleType: zod_1.z.string().nullable()
});
const ZoneWithDevicesSchema = ZoneSchema.extend({
    devices: zod_1.z.array(DeviceInZoneSchema)
});
const zonesRoutes = async (fastify) => {
    const app = fastify.withTypeProvider();
    // GET /zones - List all zones
    app.get('/zones', {
        schema: {
            tags: ['Zones'],
            summary: 'List all zones',
            response: { 200: ZoneListSchema }
        }
    }, async () => {
        const zones = await fastify.db.select().from(schema.zones);
        return zones.map(z => ({
            id: z.id,
            name: z.name,
            description: z.description || null,
            createdAt: z.createdAt?.toISOString() || null
        }));
    });
    // GET /zones/:id - Get zone with devices
    app.get('/zones/:id', {
        schema: {
            tags: ['Zones'],
            summary: 'Get zone with its devices',
            params: ZoneParamsSchema,
            response: { 200: ZoneWithDevicesSchema }
        }
    }, async (request, reply) => {
        const { id } = request.params;
        const [zone] = await fastify.db
            .select()
            .from(schema.zones)
            .where((0, drizzle_orm_1.eq)(schema.zones.id, id));
        if (!zone) {
            throw fastify.httpErrors.notFound(`Zone '${id}' not found`);
        }
        const devices = await fastify.db
            .select({
            moduleId: schema.deviceSystemStatus.moduleId,
            name: schema.deviceSystemStatus.name,
            moduleType: schema.deviceSystemStatus.moduleType
        })
            .from(schema.deviceSystemStatus)
            .where((0, drizzle_orm_1.eq)(schema.deviceSystemStatus.zoneId, id));
        return {
            id: zone.id,
            name: zone.name,
            description: zone.description || null,
            createdAt: zone.createdAt?.toISOString() || null,
            devices
        };
    });
    // POST /zones - Create zone
    app.post('/zones', {
        schema: {
            tags: ['Zones'],
            summary: 'Create a new zone',
            body: CreateZoneSchema,
            response: { 201: ZoneSchema }
        }
    }, async (request, reply) => {
        const { name, description } = request.body;
        const [zone] = await fastify.db
            .insert(schema.zones)
            .values({ name, description: description || null })
            .returning();
        fastify.log.info({ msg: `[API] Zone créée: "${name}"`, source: 'USER', zoneId: zone.id, zoneName: name });
        reply.status(201);
        return {
            id: zone.id,
            name: zone.name,
            description: zone.description || null,
            createdAt: zone.createdAt?.toISOString() || null
        };
    });
    // PUT /zones/:id - Update zone
    app.put('/zones/:id', {
        schema: {
            tags: ['Zones'],
            summary: 'Update zone name',
            params: ZoneParamsSchema,
            body: UpdateZoneSchema,
            response: { 200: ZoneSchema }
        }
    }, async (request, reply) => {
        const { id } = request.params;
        const { name, description } = request.body;
        const [zone] = await fastify.db
            .update(schema.zones)
            .set({ name, description: description ?? undefined })
            .where((0, drizzle_orm_1.eq)(schema.zones.id, id))
            .returning();
        if (!zone) {
            throw fastify.httpErrors.notFound(`Zone '${id}' not found`);
        }
        fastify.log.info({ msg: `[API] Zone modifiée: "${name}"`, source: 'USER', zoneId: id, zoneName: name });
        return {
            id: zone.id,
            name: zone.name,
            description: zone.description || null,
            createdAt: zone.createdAt?.toISOString() || null
        };
    });
    // DELETE /zones/:id - Delete zone
    app.delete('/zones/:id', {
        schema: {
            tags: ['Zones'],
            summary: 'Delete zone (devices are unassigned)',
            params: ZoneParamsSchema
        }
    }, async (request, reply) => {
        const { id } = request.params;
        // Get zone name for logging
        const [zoneToDelete] = await fastify.db
            .select({ name: schema.zones.name })
            .from(schema.zones)
            .where((0, drizzle_orm_1.eq)(schema.zones.id, id));
        // Unassign devices first
        await fastify.db
            .update(schema.deviceSystemStatus)
            .set({ zoneId: null })
            .where((0, drizzle_orm_1.eq)(schema.deviceSystemStatus.zoneId, id));
        // Delete zone
        await fastify.db
            .delete(schema.zones)
            .where((0, drizzle_orm_1.eq)(schema.zones.id, id));
        fastify.log.info({ msg: `[API] Zone supprimée: "${zoneToDelete?.name}"`, source: 'USER', zoneId: id, zoneName: zoneToDelete?.name });
        reply.status(204);
    });
    // POST /zones/:id/devices/:deviceId - Assign device to zone
    app.post('/zones/:id/devices/:deviceId', {
        schema: {
            tags: ['Zones'],
            summary: 'Assign a device to this zone',
            params: zod_1.z.object({
                id: zod_1.z.string().uuid(),
                deviceId: zod_1.z.string()
            })
        }
    }, async (request, reply) => {
        const { id, deviceId } = request.params;
        // Get zone name and device name for logging
        const [zone] = await fastify.db
            .select({ name: schema.zones.name })
            .from(schema.zones)
            .where((0, drizzle_orm_1.eq)(schema.zones.id, id));
        const [device] = await fastify.db
            .select({ preferences: schema.deviceSystemStatus.preferences })
            .from(schema.deviceSystemStatus)
            .where((0, drizzle_orm_1.eq)(schema.deviceSystemStatus.moduleId, deviceId));
        const deviceName = device?.preferences?.name || deviceId;
        await fastify.db
            .update(schema.deviceSystemStatus)
            .set({ zoneId: id })
            .where((0, drizzle_orm_1.eq)(schema.deviceSystemStatus.moduleId, deviceId));
        fastify.log.info({ msg: `[API] Module "${deviceName}" assigné à zone "${zone?.name}"`, source: 'USER', moduleId: deviceId, zoneId: id, zoneName: zone?.name });
        return { success: true, message: `Device ${deviceId} assigned to zone ${id}` };
    });
    // DELETE /zones/:id/devices/:deviceId - Remove device from zone
    app.delete('/zones/:id/devices/:deviceId', {
        schema: {
            tags: ['Zones'],
            summary: 'Remove a device from this zone',
            params: zod_1.z.object({
                id: zod_1.z.string().uuid(),
                deviceId: zod_1.z.string()
            })
        }
    }, async (request, reply) => {
        const { id, deviceId } = request.params;
        // Get zone name and device name for logging
        const [zone] = await fastify.db
            .select({ name: schema.zones.name })
            .from(schema.zones)
            .where((0, drizzle_orm_1.eq)(schema.zones.id, id));
        const [device] = await fastify.db
            .select({ preferences: schema.deviceSystemStatus.preferences })
            .from(schema.deviceSystemStatus)
            .where((0, drizzle_orm_1.eq)(schema.deviceSystemStatus.moduleId, deviceId));
        const deviceName = device?.preferences?.name || deviceId;
        // Unassign device from zone (set zoneId to null)
        await fastify.db
            .update(schema.deviceSystemStatus)
            .set({ zoneId: null })
            .where((0, drizzle_orm_1.eq)(schema.deviceSystemStatus.moduleId, deviceId));
        fastify.log.info({ msg: `[API] Module "${deviceName}" retiré de zone "${zone?.name}"`, source: 'USER', moduleId: deviceId, zoneId: id, zoneName: zone?.name });
        reply.status(204);
    });
};
exports.default = zonesRoutes;
