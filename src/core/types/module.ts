/**
 * Core types for the modular architecture.
 * Defines the structure of module manifests, sensors, hardware, and actions.
 */

// ============================================================================
// Module Manifest
// ============================================================================

export interface ModuleManifest {
  id: string              // "air-quality", "lighting", etc.
  name: string            // "Qualité d'air"
  version: string         // "1.0.0"
  hardware: HardwareDef[]
  sensors: SensorDef[]
  actions: ActionDef[]
}

// ============================================================================
// Hardware Definition
// ============================================================================

export interface HardwareDef {
  key: string             // "dht22", "sps30"
  name: string            // "DHT22", "SPS30"
  type: 'sensor' | 'actuator'
  sensors: string[]       // ["temperature", "humidity"]
}

// ============================================================================
// Sensor Definition
// ============================================================================

export interface SensorDef {
  key: string             // "temperature"
  label: string           // "Température"
  unit: string            // "°C"
  range: { min: number; max: number }  // { min: -40, max: 85 }
}

// ============================================================================
// Action Definition
// ============================================================================

export interface ActionDef {
  id: string              // "reset", "calibrate"
  label: string           // "Redémarrer"
  icon: string            // "refresh"
  scope: 'sensor' | 'hardware' | 'device'
}
