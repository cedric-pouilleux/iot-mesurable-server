import { FastifyPluginAsync } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { registry } from '../../core/registry'

/**
 * Module Types Routes
 * 
 * Provides API access to module type definitions (manifests).
 * These define sensors, hardware, actions for each module type.
 */

// Schemas
const ModuleTypeParamsSchema = z.object({
  type: z.string()
})

const ModuleTypeListSchema = z.array(z.object({
  id: z.string(),
  name: z.string(),
  version: z.string()
}))

const ModuleManifestSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  hardware: z.array(z.object({
    key: z.string(),
    name: z.string(),
    type: z.enum(['sensor', 'actuator']),
    sensors: z.array(z.string())
  })),
  sensors: z.array(z.object({
    key: z.string(),
    label: z.string(),
    unit: z.string(),
    range: z.object({ min: z.number(), max: z.number() })
  })),
  actions: z.array(z.object({
    id: z.string(),
    label: z.string(),
    icon: z.string(),
    scope: z.enum(['sensor', 'hardware', 'device'])
  }))
})

const moduleTypesRoutes: FastifyPluginAsync = async fastify => {
  const app = fastify.withTypeProvider<ZodTypeProvider>()

  // GET /modules/types - List all available module types
  app.get(
    '/modules/types',
    {
      schema: {
        tags: ['Module Types'],
        summary: 'List all available module types',
        response: {
          200: ModuleTypeListSchema
        }
      }
    },
    async () => {
      const manifests = registry.getAllManifests()
      return manifests.map(m => ({
        id: m.id,
        name: m.name,
        version: m.version
      }))
    }
  )

  // GET /modules/types/:type/manifest - Get full manifest for a module type
  app.get(
    '/modules/types/:type/manifest',
    {
      schema: {
        tags: ['Module Types'],
        summary: 'Get full manifest for a module type',
        params: ModuleTypeParamsSchema,
        response: {
          200: ModuleManifestSchema
        }
      }
    },
    async (request, reply) => {
      const { type } = request.params
      const manifest = registry.getManifest(type)
      
      if (!manifest) {
        throw fastify.httpErrors.notFound(`Module type '${type}' not found`)
      }
      
      return manifest
    }
  )
}

export default moduleTypesRoutes
