import 'fastify'

declare module 'fastify' {
  interface FastifyBaseLogger {
    success: FastifyLogFn
  }
}
