"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registry = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
// ============================================================================
// Registry Class
// ============================================================================
class ModuleRegistry {
    manifests = new Map();
    loaded = false;
    /**
     * Load all module manifests from the modules directory
     */
    async loadAll() {
        if (this.loaded)
            return;
        const modulesDir = path_1.default.join(__dirname, '../modules');
        try {
            const dirs = await promises_1.default.readdir(modulesDir);
            for (const dir of dirs) {
                const manifestPath = path_1.default.join(modulesDir, dir, 'manifest.json');
                try {
                    const content = await promises_1.default.readFile(manifestPath, 'utf-8');
                    const manifest = JSON.parse(content);
                    this.manifests.set(manifest.id, manifest);
                }
                catch (e) {
                    // Ignore if manifest doesn't exist (expected for utility modules)
                    if (e.code !== 'ENOENT') {
                        console.error(`Failed to load manifest in ${dir}:`, e);
                    }
                }
            }
            this.loaded = true;
        }
        catch (err) {
            console.error('Failed to load module manifests:', err);
        }
    }
    /**
     * Get a specific module manifest
     */
    getManifest(moduleType) {
        return this.manifests.get(moduleType);
    }
    /**
     * Get all loaded manifests
     */
    getAllManifests() {
        return Array.from(this.manifests.values());
    }
    /**
     * Get all module type IDs
     */
    getModuleTypes() {
        return Array.from(this.manifests.keys());
    }
    /**
     * Get sensor definition by type (searches all manifests)
     */
    getSensorDef(sensorType) {
        for (const manifest of this.manifests.values()) {
            const sensor = manifest.sensors.find(s => s.key === sensorType);
            if (sensor)
                return sensor;
        }
        return undefined;
    }
    /**
     * Get validation range for a sensor type
     */
    getValidationRange(sensorType) {
        const sensor = this.getSensorDef(sensorType);
        if (!sensor)
            return null;
        return sensor.range;
    }
}
// ============================================================================
// Singleton Export
// ============================================================================
exports.registry = new ModuleRegistry();
