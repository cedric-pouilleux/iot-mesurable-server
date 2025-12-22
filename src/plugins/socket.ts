import fp from 'fastify-plugin'
import { Server, Socket } from 'socket.io'

declare module 'fastify' {
  interface FastifyInstance {
    io: Server
  }
}

export default fp(async fastify => {
  const io = new Server(fastify.server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  })

  let connectedClients = 0

  io.on('connection', (socket: Socket) => {
    connectedClients++
    const clientInfo = {
      id: socket.id,
      ip: socket.handshake.address,
      userAgent: socket.handshake.headers['user-agent'] || 'unknown',
      transport: socket.conn.transport.name,
    }

    fastify.log.success({
      msg: `[WEBSOCKET] Client connected (${clientInfo.ip})`,
      source: 'USER',
      socketId: clientInfo.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      transport: clientInfo.transport,
      totalClients: connectedClients,
    })

    socket.on('disconnect', (reason: string) => {
      connectedClients = Math.max(0, connectedClients - 1)
      fastify.log.info({
        msg: '[WEBSOCKET] Client disconnected',
        source: 'USER',
        socketId: clientInfo.id,
        reason,
        totalClients: connectedClients,
      })
    })

    socket.on('error', (error: Error) => {
      fastify.log.error({
        msg: '[WEBSOCKET] Socket error',
        socketId: clientInfo.id,
        error: error.message,
        stack: error.stack,
      })
    })

    socket.on('connect_error', (error: Error) => {
      fastify.log.error({
        msg: '[WEBSOCKET] Connection error',
        socketId: clientInfo.id,
        error: error.message,
      })
    })
  })

  io.engine.on('connection_error', (err: Error) => {
    fastify.log.error({
      msg: '[WEBSOCKET] Engine connection error',
      error: err.message,
      stack: err.stack,
    })
  })

  fastify.decorate('io', io)

  fastify.addHook('onClose', (instance, done) => {
    fastify.log.info({
      msg: '[WEBSOCKET] Closing Socket.IO server',
      connectedClients,
    })
    instance.io.close()
    done()
  })
})
