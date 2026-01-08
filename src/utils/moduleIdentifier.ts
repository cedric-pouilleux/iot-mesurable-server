/**
 * Module identifier utilities
 * Handles encoding/decoding of composite module identifiers
 * Format: {moduleId}@{chipId}
 */

export interface ModuleIdentifier {
    moduleId: string
    chipId: string
}

/**
 * Encode a composite module identifier
 * @param moduleId - The logical module name (e.g., "air-quality")
 * @param chipId - The hardware chip ID (e.g., "0000347B4EE81F84")
 * @returns Composite identifier (e.g., "air-quality@0000347B4EE81F84")
 */
export function encodeModuleId(moduleId: string, chipId: string): string {
    if (!moduleId || !chipId) {
        throw new Error('Both moduleId and chipId are required')
    }
    return `${moduleId}@${chipId}`
}

/**
 * Decode a composite module identifier
 * @param compositeId - The composite identifier (e.g., "air-quality@0000347B4EE81F84")
 * @returns Object with moduleId and chipId
 * @throws Error if format is invalid
 */
export function decodeModuleId(compositeId: string): ModuleIdentifier {
    if (!compositeId || typeof compositeId !== 'string') {
        throw new Error('Invalid composite ID: must be a non-empty string')
    }

    const parts = compositeId.split('@')
    if (parts.length !== 2) {
        throw new Error(`Invalid module identifier format: "${compositeId}". Expected format: moduleId@chipId`)
    }

    const [moduleId, chipId] = parts

    if (!moduleId || !chipId) {
        throw new Error(`Invalid module identifier: "${compositeId}". Both moduleId and chipId must be non-empty`)
    }

    return { moduleId, chipId }
}

/**
 * Check if a string is a composite identifier
 * @param id - The ID to check
 */
export function isCompositeId(id: string): boolean {
    return typeof id === 'string' && id.includes('@') && id.split('@').length === 2
}

/**
 * Format chipId for display (last 8 characters)
 * @param chipId - Full chip ID
 */
export function formatChipIdShort(chipId: string): string {
    return chipId.slice(-8)
}
