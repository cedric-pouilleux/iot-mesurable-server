import { db } from '../src/db/client.js';
import * as schema from '../src/db/schema.js';
import { and, eq, gte, desc } from 'drizzle-orm';

(async () => {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

    console.log('=== Extended VOC Depth Analysis ===\n');

    // Get all recent SGP40 readings with exact timestamps
    const vocReadings = await db.select().from(schema.measurements)
        .where(and(
            eq(schema.measurements.sensorType, 'voc'),
            eq(schema.measurements.hardwareId, 'sgp40'),
            gte(schema.measurements.time, oneMinuteAgo)
        ))
        .orderBy(desc(schema.measurements.time))
        .limit(20);

    console.log('\n📊 Recent VOC Readings (last minute):');
    for (const reading of vocReadings) {
        const time = reading.time.toISOString().substr(11, 8);
        console.log(`  ${time} - ${reading.moduleId}: VOC=${reading.value}`);
    }

    // Now check what temperature/humidity values existed AT THE SAME TIME
    console.log('\n🌡️ Temperature/Humidity Context:\n');

    for (const moduleId of ['air-quality', 'air-quality-benchmark']) {
        console.log(`\n📦 ${moduleId}:`);

        // Get VOC reading
        const voc = await db.select().from(schema.measurements)
            .where(and(
                eq(schema.measurements.moduleId, moduleId),
                eq(schema.measurements.sensorType, 'voc'),
                gte(schema.measurements.time, oneMinuteAgo)
            ))
            .orderBy(desc(schema.measurements.time))
            .limit(1);

        if (voc.length === 0) continue;

        const vocTime = voc[0].time;
        console.log(`  Latest VOC: ${voc[0].value} at ${vocTime.toISOString()}`);

        // Get temperature readings around that time (±10 seconds)
        const tenSecondsBefore = new Date(vocTime.getTime() - 10000);
        const tenSecondsAfter = new Date(vocTime.getTime() + 10000);

        const temps = await db.select().from(schema.measurements)
            .where(and(
                eq(schema.measurements.moduleId, moduleId),
                eq(schema.measurements.sensorType, 'temperature'),
                gte(schema.measurements.time, tenSecondsBefore)
            ))
            .orderBy(desc(schema.measurements.time))
            .limit(5);

        const hums = await db.select().from(schema.measurements)
            .where(and(
                eq(schema.measurements.moduleId, moduleId),
                eq(schema.measurements.sensorType, 'humidity'),
                gte(schema.measurements.time, tenSecondsBefore)
            ))
            .orderBy(desc(schema.measurements.time))
            .limit(5);

        console.log(`\n  Temperature readings (±10s from VOC):`);
        temps.forEach(t => {
            const delta = (t.time.getTime() - vocTime.getTime()) / 1000;
            console.log(`    ${t.value.toFixed(1)}°C from ${t.hardwareId} (${delta > 0 ? '+' : ''}${delta.toFixed(1)}s)`);
        });

        console.log(`\n  Humidity readings (±10s from VOC):`);
        hums.forEach(h => {
            const delta = (h.time.getTime() - vocTime.getTime()) / 1000;
            console.log(`    ${h.value.toFixed(1)}% from ${h.hardwareId} (${delta > 0 ? '+' : ''}${delta.toFixed(1)}s)`);
        });
    }

    console.log('\n✅ Analysis complete\n');
    process.exit(0);
})();
