/**
 * Module Registry
 * 
 * Loads and provides access to module manifests.
 * Manifests define sensors, hardware, actions, and validation rules.
 */
import type { ModuleManifest, SensorDef } from './types/module'
import fs from 'fs/promises'
import path from 'path'

// ============================================================================
// Registry Class
// ============================================================================

class ModuleRegistry {
  private manifests = new Map<string, ModuleManifest>()
  private loaded = false

  /**
   * Load all module manifests from the modules directory
   */
  async loadAll(): Promise<void> {
    if (this.loaded) return

    const modulesDir = path.join(__dirname, '../modules')
    
    try {
      const dirs = await fs.readdir(modulesDir)
      
      for (const dir of dirs) {
        const manifestPath = path.join(modulesDir, dir, 'manifest.json')
        try {
          const content = await fs.readFile(manifestPath, 'utf-8')
          const manifest: ModuleManifest = JSON.parse(content)
          this.manifests.set(manifest.id, manifest)
        } catch (e: any) {
          // Ignore if manifest doesn't exist (expected for utility modules)
          if (e.code !== 'ENOENT') {
            console.error(`Failed to load manifest in ${dir}:`, e)
          }
        }
      }
      
      this.loaded = true
    } catch (err) {
      console.error('Failed to load module manifests:', err)
    }
  }

  /**
   * Get a specific module manifest
   */
  getManifest(moduleType: string): ModuleManifest | undefined {
    return this.manifests.get(moduleType)
  }

  /**
   * Get all loaded manifests
   */
  getAllManifests(): ModuleManifest[] {
    return Array.from(this.manifests.values())
  }

  /**
   * Get all module type IDs
   */
  getModuleTypes(): string[] {
    return Array.from(this.manifests.keys())
  }

  /**
   * Get sensor definition by type (searches all manifests)
   */
  getSensorDef(sensorType: string): SensorDef | undefined {
    for (const manifest of this.manifests.values()) {
      const sensor = manifest.sensors.find(s => s.key === sensorType)
      if (sensor) return sensor
    }
    return undefined
  }

  /**
   * Get validation range for a sensor type
   */
  getValidationRange(sensorType: string): { min: number; max: number } | null {
    const sensor = this.getSensorDef(sensorType)
    if (!sensor) return null
    return sensor.range
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const registry = new ModuleRegistry()
