"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const registry_1 = require("../../core/registry");
/**
 * Module Types Routes
 *
 * Provides API access to module type definitions (manifests).
 * These define sensors, hardware, actions for each module type.
 */
// Schemas
const ModuleTypeParamsSchema = zod_1.z.object({
    type: zod_1.z.string()
});
const ModuleTypeListSchema = zod_1.z.array(zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    version: zod_1.z.string()
}));
const ModuleManifestSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    version: zod_1.z.string(),
    hardware: zod_1.z.array(zod_1.z.object({
        key: zod_1.z.string(),
        name: zod_1.z.string(),
        type: zod_1.z.enum(['sensor', 'actuator']),
        sensors: zod_1.z.array(zod_1.z.string())
    })),
    sensors: zod_1.z.array(zod_1.z.object({
        key: zod_1.z.string(),
        label: zod_1.z.string(),
        unit: zod_1.z.string(),
        range: zod_1.z.object({ min: zod_1.z.number(), max: zod_1.z.number() })
    })),
    actions: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        label: zod_1.z.string(),
        icon: zod_1.z.string(),
        scope: zod_1.z.enum(['sensor', 'hardware', 'device'])
    }))
});
const moduleTypesRoutes = async (fastify) => {
    const app = fastify.withTypeProvider();
    // GET /modules/types - List all available module types
    app.get('/modules/types', {
        schema: {
            tags: ['Module Types'],
            summary: 'List all available module types',
            response: {
                200: ModuleTypeListSchema
            }
        }
    }, async () => {
        const manifests = registry_1.registry.getAllManifests();
        return manifests.map(m => ({
            id: m.id,
            name: m.name,
            version: m.version
        }));
    });
    // GET /modules/types/:type/manifest - Get full manifest for a module type
    app.get('/modules/types/:type/manifest', {
        schema: {
            tags: ['Module Types'],
            summary: 'Get full manifest for a module type',
            params: ModuleTypeParamsSchema,
            response: {
                200: ModuleManifestSchema
            }
        }
    }, async (request, reply) => {
        const { type } = request.params;
        const manifest = registry_1.registry.getManifest(type);
        if (!manifest) {
            throw fastify.httpErrors.notFound(`Module type '${type}' not found`);
        }
        return manifest;
    });
};
exports.default = moduleTypesRoutes;
