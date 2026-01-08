import { db } from '../src/db/client.js';
import * as schema from '../src/db/schema.js';
import { and, eq, gte, desc } from 'drizzle-orm';

(async () => {
    const moduleIds = ['air-quality', 'air-quality-benchmark'];
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    console.log('===  VOC Compensation Comparison ===\n');

    for (const moduleId of moduleIds) {
        console.log(`\n📦 Module: ${moduleId}`);

        // Get latest temperature
        const temps = await db.select().from(schema.measurements)
            .where(and(
                eq(schema.measurements.moduleId, moduleId),
                eq(schema.measurements.sensorType, 'temperature'),
                gte(schema.measurements.time, fiveMinutesAgo)
            ))
            .orderBy(desc(schema.measurements.time))
            .limit(5);

        // Get latest humidity
        const hums = await db.select().from(schema.measurements)
            .where(and(
                eq(schema.measurements.moduleId, moduleId),
                eq(schema.measurements.sensorType, 'humidity'),
                gte(schema.measurements.time, fiveMinutesAgo)
            ))
            .orderBy(desc(schema.measurements.time))
            .limit(5);

        // Get latest VOC
        const vocs = await db.select().from(schema.measurements)
            .where(and(
                eq(schema.measurements.moduleId, moduleId),
                eq(schema.measurements.sensorType, 'voc'),
                gte(schema.measurements.time, fiveMinutesAgo)
            ))
            .orderBy(desc(schema.measurements.time))
            .limit(5);

        if (temps.length > 0) {
            const avgTemp = temps.reduce((sum, m) => sum + m.value, 0) / temps.length;
            console.log(`  Temperature: ${avgTemp.toFixed(1)}°C (sensor: ${temps[0].hardwareId})`);
        } else {
            console.log(`  Temperature: NO DATA`);
        }

        if (hums.length > 0) {
            const avgHum = hums.reduce((sum, m) => sum + m.value, 0) / hums.length;
            console.log(`  Humidity: ${avgHum.toFixed(1)}% (sensor: ${hums[0].hardwareId})`);
        } else {
            console.log(`  Humidity: NO DATA`);
        }

        if (vocs.length > 0) {
            const avgVoc = vocs.reduce((sum, m) => sum + m.value, 0) / vocs.length;
            console.log(`  VOC Index: ${avgVoc.toFixed(0)} (sensor: ${vocs[0].hardwareId})`);
        } else {
            console.log(`  VOC: NO DATA`);
        }
    }

    console.log('\n✅ Comparison complete\n');
    process.exit(0);
})();
