import { FastifyPluginAsync } from 'fastify'
import fastifyPlugin from 'fastify-plugin'
import { GapDetectionService } from '../modules/devices/gapDetectionService'

declare module 'fastify' {
    interface FastifyInstance {
        gapDetection: GapDetectionService
    }
}

const gapDetectionPlugin: FastifyPluginAsync = async (fastify) => {
    const gapDetection = new GapDetectionService(fastify.db, fastify.log)

    // Start the service with 15-minute interval
    gapDetection.start(15)

    // Decorate fastify instance for access in routes if needed
    fastify.decorate('gapDetection', gapDetection)

    // Graceful shutdown
    fastify.addHook('onClose', async () => {
        fastify.log.info('Stopping gap detection service...')
        gapDetection.stop()
    })
}

export default fastifyPlugin(gapDetectionPlugin)
