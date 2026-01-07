#!/usr/bin/env node
/**
 * Monitor MQTT messages in real-time to debug issues
 */

import mqtt from 'mqtt'
import { config } from '../src/config/env.js'

const client = mqtt.connect(config.mqtt.broker)

console.log('🔌 Connecting to MQTT broker:', config.mqtt.broker)

client.on('connect', () => {
    console.log('✅ Connected to MQTT broker')
    console.log('📡 Subscribing to all topics (#)...\n')

    client.subscribe('#', (err) => {
        if (err) {
            console.error('❌ Subscription failed:', err)
            process.exit(1)
        }
        console.log('👂 Listening for messages...\n')
    })
})

client.on('message', (topic, message) => {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}]`)
    console.log(`📨 Topic: ${topic}`)

    try {
        const parsed = JSON.parse(message.toString())
        console.log('📦 Payload:', JSON.stringify(parsed, null, 2))

        // Highlight chipId if present
        if (parsed.chipId) {
            console.log(`✨ chipId detected: ${parsed.chipId}`)
        }
    } catch {
        console.log('📦 Payload (raw):', message.toString())
    }

    console.log('─'.repeat(80) + '\n')
})

client.on('error', (err) => {
    console.error('❌ MQTT Error:', err.message)
})

console.log('Press Ctrl+C to stop\n')
