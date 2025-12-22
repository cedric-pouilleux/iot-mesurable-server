import { FastifyPluginAsync } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import * as schema from '../../db/schema'

/**
 * Zones Routes
 * 
 * CRUD operations for zones (physical locations that group devices).
 */

// Schemas
const ZoneSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.string().nullable()
})

const ZoneListSchema = z.array(ZoneSchema)

const CreateZoneSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().nullable()
})

const UpdateZoneSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().nullable()
})

const ZoneParamsSchema = z.object({
  id: z.string().uuid()
})

const DeviceInZoneSchema = z.object({
  moduleId: z.string(),
  name: z.string().nullable(),
  moduleType: z.string().nullable()
})

const ZoneWithDevicesSchema = ZoneSchema.extend({
  devices: z.array(DeviceInZoneSchema)
})

const zonesRoutes: FastifyPluginAsync = async fastify => {
  const app = fastify.withTypeProvider<ZodTypeProvider>()

  // GET /zones - List all zones
  app.get(
    '/zones',
    {
      schema: {
        tags: ['Zones'],
        summary: 'List all zones',
        response: { 200: ZoneListSchema }
      }
    },
    async () => {
      const zones = await fastify.db.select().from(schema.zones)
      return zones.map(z => ({
        id: z.id,
        name: z.name,
        description: z.description || null,
        createdAt: z.createdAt?.toISOString() || null
      }))
    }
  )

  // GET /zones/:id - Get zone with devices
  app.get(
    '/zones/:id',
    {
      schema: {
        tags: ['Zones'],
        summary: 'Get zone with its devices',
        params: ZoneParamsSchema,
        response: { 200: ZoneWithDevicesSchema }
      }
    },
    async (request, reply) => {
      const { id } = request.params
      
      const [zone] = await fastify.db
        .select()
        .from(schema.zones)
        .where(eq(schema.zones.id, id))
      
      if (!zone) {
        throw fastify.httpErrors.notFound(`Zone '${id}' not found`)
      }
      
      const devices = await fastify.db
        .select({
          moduleId: schema.deviceSystemStatus.moduleId,
          name: schema.deviceSystemStatus.name,
          moduleType: schema.deviceSystemStatus.moduleType
        })
        .from(schema.deviceSystemStatus)
        .where(eq(schema.deviceSystemStatus.zoneId, id))
      
      return {
        id: zone.id,
        name: zone.name,
        description: zone.description || null,
        createdAt: zone.createdAt?.toISOString() || null,
        devices
      }
    }
  )

  // POST /zones - Create zone
  app.post(
    '/zones',
    {
      schema: {
        tags: ['Zones'],
        summary: 'Create a new zone',
        body: CreateZoneSchema,
        response: { 201: ZoneSchema }
      }
    },
    async (request, reply) => {
      const { name, description } = request.body
      
      const [zone] = await fastify.db
        .insert(schema.zones)
        .values({ name, description: description || null })
        .returning()
      
      fastify.log.info({ msg: `[API] Zone créée: "${name}"`, source: 'USER', zoneId: zone.id, zoneName: name })
      
      reply.status(201)
      return {
        id: zone.id,
        name: zone.name,
        description: zone.description || null,
        createdAt: zone.createdAt?.toISOString() || null
      }
    }
  )

  // PUT /zones/:id - Update zone
  app.put(
    '/zones/:id',
    {
      schema: {
        tags: ['Zones'],
        summary: 'Update zone name',
        params: ZoneParamsSchema,
        body: UpdateZoneSchema,
        response: { 200: ZoneSchema }
      }
    },
    async (request, reply) => {
      const { id } = request.params
      const { name, description } = request.body
      
      const [zone] = await fastify.db
        .update(schema.zones)
        .set({ name, description: description ?? undefined })
        .where(eq(schema.zones.id, id))
        .returning()
      
      if (!zone) {
        throw fastify.httpErrors.notFound(`Zone '${id}' not found`)
      }
      
      fastify.log.info({ msg: `[API] Zone modifiée: "${name}"`, source: 'USER', zoneId: id, zoneName: name })
      
      return {
        id: zone.id,
        name: zone.name,
        description: zone.description || null,
        createdAt: zone.createdAt?.toISOString() || null
      }
    }
  )

  // DELETE /zones/:id - Delete zone
  app.delete(
    '/zones/:id',
    {
      schema: {
        tags: ['Zones'],
        summary: 'Delete zone (devices are unassigned)',
        params: ZoneParamsSchema
      }
    },
    async (request, reply) => {
      const { id } = request.params
      
      // Get zone name for logging
      const [zoneToDelete] = await fastify.db
        .select({ name: schema.zones.name })
        .from(schema.zones)
        .where(eq(schema.zones.id, id))
      
      // Unassign devices first
      await fastify.db
        .update(schema.deviceSystemStatus)
        .set({ zoneId: null })
        .where(eq(schema.deviceSystemStatus.zoneId, id))
      
      // Delete zone
      await fastify.db
        .delete(schema.zones)
        .where(eq(schema.zones.id, id))
      
      fastify.log.info({ msg: `[API] Zone supprimée: "${zoneToDelete?.name}"`, source: 'USER', zoneId: id, zoneName: zoneToDelete?.name })
      
      reply.status(204)
    }
  )

  // POST /zones/:id/devices/:deviceId - Assign device to zone
  app.post(
    '/zones/:id/devices/:deviceId',
    {
      schema: {
        tags: ['Zones'],
        summary: 'Assign a device to this zone',
        params: z.object({
          id: z.string().uuid(),
          deviceId: z.string()
        })
      }
    },
    async (request, reply) => {
      const { id, deviceId } = request.params
      
      // Get zone name and device name for logging
      const [zone] = await fastify.db
        .select({ name: schema.zones.name })
        .from(schema.zones)
        .where(eq(schema.zones.id, id))
      
      const [device] = await fastify.db
        .select({ preferences: schema.deviceSystemStatus.preferences })
        .from(schema.deviceSystemStatus)
        .where(eq(schema.deviceSystemStatus.moduleId, deviceId))
      
      const deviceName = (device?.preferences as any)?.name || deviceId
      
      await fastify.db
        .update(schema.deviceSystemStatus)
        .set({ zoneId: id })
        .where(eq(schema.deviceSystemStatus.moduleId, deviceId))
      
      fastify.log.info({ msg: `[API] Module "${deviceName}" assigné à zone "${zone?.name}"`, source: 'USER', moduleId: deviceId, zoneId: id, zoneName: zone?.name })
      
      return { success: true, message: `Device ${deviceId} assigned to zone ${id}` }
    }
  )

  // DELETE /zones/:id/devices/:deviceId - Remove device from zone
  app.delete(
    '/zones/:id/devices/:deviceId',
    {
      schema: {
        tags: ['Zones'],
        summary: 'Remove a device from this zone',
        params: z.object({
          id: z.string().uuid(),
          deviceId: z.string()
        })
      }
    },
    async (request, reply) => {
      const { id, deviceId } = request.params
      
      // Get zone name and device name for logging
      const [zone] = await fastify.db
        .select({ name: schema.zones.name })
        .from(schema.zones)
        .where(eq(schema.zones.id, id))
      
      const [device] = await fastify.db
        .select({ preferences: schema.deviceSystemStatus.preferences })
        .from(schema.deviceSystemStatus)
        .where(eq(schema.deviceSystemStatus.moduleId, deviceId))
      
      const deviceName = (device?.preferences as any)?.name || deviceId
      
      // Unassign device from zone (set zoneId to null)
      await fastify.db
        .update(schema.deviceSystemStatus)
        .set({ zoneId: null })
        .where(eq(schema.deviceSystemStatus.moduleId, deviceId))
      
      fastify.log.info({ msg: `[API] Module "${deviceName}" retiré de zone "${zone?.name}"`, source: 'USER', moduleId: deviceId, zoneId: id, zoneName: zone?.name })
      
      reply.status(204)
    }
  )
}

export default zonesRoutes
