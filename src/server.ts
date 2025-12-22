import { buildApp } from './app'
import { config } from './config/env'
import os from 'os'

function getNetworkInterfaces(): { ip: string; type: string }[] {
  const interfaces = os.networkInterfaces()
  const results: { ip: string; type: string }[] = []

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        let type = 'Network'
        if (addr.address.startsWith('192.168.') || addr.address.startsWith('10.')) {
          type = 'LAN'
        } else if (addr.address.startsWith('172.')) {
          type = 'WSL/Docker'
        }
        results.push({ ip: addr.address, type })
      }
    }
  }

  return results
}

async function start() {
  const app = await buildApp()

  try {
    // Disable Fastify's automatic listening logs by using a custom listener
    await app.listen({ port: config.api.port, host: '0.0.0.0' })

    // Log startup with custom messages
    app.log.success({
      msg: `✓ Server listening on localhost:${config.api.port}`,
      interface: 'Localhost',
      url: `http://localhost:${config.api.port}`,
    })

    // Log each network interface
    const interfaces = getNetworkInterfaces()
    for (const iface of interfaces) {
      app.log.success({
        msg: `✓ Server listening on ${iface.ip}:${config.api.port} (${iface.type})`,
        interface: iface.type,
        url: `http://${iface.ip}:${config.api.port}`,
      })
    }

    console.log(`🚀 Server running at http://localhost:${config.api.port}`)
    console.log(`📚 Documentation at http://localhost:${config.api.port}/documentation`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
