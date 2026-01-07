/**
 * Script to clean retained MQTT messages for old module IDs
 * 
 * This removes "ghost" messages that persist in the MQTT broker even after
 * devices have been reconfigured with new module IDs.
 */

import mqtt from 'mqtt'

const BROKER_URL = 'mqtt://localhost:1883'
const OLD_MODULE_IDS = ['module-air-bootstrap', 'module-esp32-1']

async function cleanRetainedMessages() {
    console.log('🧹 Cleaning retained MQTT messages for old modules...\n')

    return new Promise<void>((resolve, reject) => {
        const client = mqtt.connect(BROKER_URL, {
            clientId: `mqtt-cleanup-${Date.now()}`,
        })

        client.on('connect', () => {
            console.log('✅ Connected to MQTT broker\n')

            // Subscribe to all topics to discover retained messages
            client.subscribe('#', { qos: 0 }, (err) => {
                if (err) {
                    console.error('❌ Failed to subscribe:', err)
                    client.end()
                    reject(err)
                    return
                }

                console.log('📡 Listening for retained messages...\n')

                // Track which topics we've seen
                const retainedTopics = new Set<string>()
                let messageCount = 0

                // Listen for messages
                client.on('message', (topic, payload, packet) => {
                    messageCount++

                    // Check if this message is retained
                    if (packet.retain) {
                        retainedTopics.add(topic)

                        // Check if it belongs to an old module
                        const isOldModule = OLD_MODULE_IDS.some(oldId => topic.startsWith(`${oldId}/`))

                        if (isOldModule) {
                            console.log(`🗑️  Found retained message: ${topic}`)
                        }
                    }
                })

                // Wait 3 seconds to collect all retained messages
                setTimeout(() => {
                    console.log(`\n📊 Total messages received: ${messageCount}`)
                    console.log(`📌 Total retained topics: ${retainedTopics.size}\n`)

                    // Filter topics for old modules
                    const topicsToDelete = Array.from(retainedTopics).filter(topic =>
                        OLD_MODULE_IDS.some(oldId => topic.startsWith(`${oldId}/`))
                    )

                    if (topicsToDelete.length === 0) {
                        console.log('✅ No retained messages found for old modules')
                        client.end()
                        resolve()
                        return
                    }

                    console.log(`🗑️  Deleting ${topicsToDelete.length} retained message(s):\n`)

                    // Delete retained messages by publishing empty payload with retain flag
                    let deleteCount = 0
                    topicsToDelete.forEach(topic => {
                        client.publish(topic, '', { retain: true, qos: 0 }, (err) => {
                            if (err) {
                                console.error(`   ❌ Failed to delete ${topic}:`, err)
                            } else {
                                console.log(`   ✓ Deleted: ${topic}`)
                            }

                            deleteCount++

                            // Close connection after all deletions
                            if (deleteCount === topicsToDelete.length) {
                                setTimeout(() => {
                                    console.log('\n✅ Cleanup complete!')
                                    client.end()
                                    resolve()
                                }, 500)
                            }
                        })
                    })
                }, 3000)
            })
        })

        client.on('error', (err) => {
            console.error('❌ MQTT error:', err)
            client.end()
            reject(err)
        })
    })
}

cleanRetainedMessages()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('❌ Script failed:', err)
        process.exit(1)
    })
