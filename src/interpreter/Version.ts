/**
 * Enum representing the different Z-machine versions
 */
export enum ZMachineVersion {
  V1 = 1,
  V2 = 2,
  V3 = 3,
  V4 = 4,
  V5 = 5,
  V6 = 6,
  V7 = 7,
  V8 = 8,
}

/**
 * Z-machine capabilities that vary by version
 */
export interface VersionCapabilities {
  maxObjects: number;
  attributeCount: number;
  propertyDefaultsTableSize: number;
  objectEntrySize: number;
  objectEntryOffset: number;
  extendedOpcodes: boolean;
  variableLengthObjects: boolean;
  unicodeSupport: boolean;
  hasPictures: boolean;
  hasSound: boolean;
  hasUndoSupport: boolean;
}

/**
 * Get the capabilities for a specific Z-machine version
 * @param version Z-machine version
 * @returns Capabilities for the specified version
 */
export function getVersionCapabilities(version: ZMachineVersion): VersionCapabilities {
  switch (version) {
    case ZMachineVersion.V1:
    case ZMachineVersion.V2:
    case ZMachineVersion.V3:
      return {
        maxObjects: 255,
        attributeCount: 32,
        propertyDefaultsTableSize: 31,
        objectEntrySize: 9,
        objectEntryOffset: 62, // 31 property defaults * 2 bytes each
        extendedOpcodes: false,
        variableLengthObjects: false,
        unicodeSupport: false,
        hasPictures: false,
        hasSound: false,
        hasUndoSupport: false,
      };
    case ZMachineVersion.V4:
    case ZMachineVersion.V5:
      return {
        maxObjects: 65535,
        attributeCount: 48,
        propertyDefaultsTableSize: 63,
        objectEntrySize: 14,
        objectEntryOffset: 126, // 63 property defaults * 2 bytes each
        extendedOpcodes: true,
        variableLengthObjects: true,
        unicodeSupport: false,
        hasPictures: version === ZMachineVersion.V5,
        hasSound: version === ZMachineVersion.V5,
        hasUndoSupport: version === ZMachineVersion.V5,
      };
    case ZMachineVersion.V6:
    case ZMachineVersion.V7:
      return {
        maxObjects: 65535,
        attributeCount: 48,
        propertyDefaultsTableSize: 63,
        objectEntrySize: 14,
        objectEntryOffset: 126, // 63 property defaults * 2 bytes each
        extendedOpcodes: true,
        variableLengthObjects: true,
        unicodeSupport: version === ZMachineVersion.V7,
        hasPictures: version === ZMachineVersion.V6,
        hasSound: true,
        hasUndoSupport: true,
      };
    case ZMachineVersion.V8:
      return {
        maxObjects: 65535,
        attributeCount: 48,
        propertyDefaultsTableSize: 63,
        objectEntrySize: 14,
        objectEntryOffset: 126, // 63 property defaults * 2 bytes each
        extendedOpcodes: true,
        variableLengthObjects: true,
        unicodeSupport: true,
        hasPictures: false,
        hasSound: true,
        hasUndoSupport: true,
      };
    default:
      throw new Error(`Unknown Z-machine version: ${version}`);
  }
}

/**
 * Determines if a Z-machine version supports a specific feature
 * @param version Z-machine version
 * @param feature Feature to check
 * @returns True if the version supports the feature
 */
export function versionSupports(version: ZMachineVersion, feature: keyof VersionCapabilities): boolean {
  const capabilities = getVersionCapabilities(version);
  return capabilities[feature] as boolean;
}

/**
 * Unpacks a routine address according to version-specific rules
 * @param version Z-machine version
 * @param packedAddr Packed address
 * @param routineOffset Routine offset (only used in V6-7)
 * @returns Unpacked address
 */
export function unpackRoutineAddress(
  version: ZMachineVersion,
  packedAddr: number,
  routineOffset: number = 0
): number {
  if (version <= ZMachineVersion.V3) {
    return 2 * packedAddr;
  } else if (version <= ZMachineVersion.V5) {
    return 4 * packedAddr;
  } else if (version <= ZMachineVersion.V7) {
    return 4 * packedAddr + routineOffset;
  } else if (version === ZMachineVersion.V8) {
    return 8 * packedAddr;
  } else {
    throw new Error(`Unknown Z-machine version: ${version}`);
  }
}

/**
 * Unpacks a string address according to version-specific rules
 * @param version Z-machine version
 * @param packedAddr Packed address
 * @param stringOffset String offset (only used in V6-7)
 * @returns Unpacked address
 */
export function unpackStringAddress(
  version: ZMachineVersion,
  packedAddr: number,
  stringOffset: number = 0
): number {
  if (version <= ZMachineVersion.V3) {
    return 2 * packedAddr;
  } else if (version <= ZMachineVersion.V5) {
    return 4 * packedAddr;
  } else if (version <= ZMachineVersion.V7) {
    return 4 * packedAddr + stringOffset;
  } else if (version === ZMachineVersion.V8) {
    return 8 * packedAddr;
  } else {
    throw new Error(`Unknown Z-machine version: ${version}`);
  }
}

/**
 * Gets the maximum text buffer length for read operations
 * @param version Z-machine version
 * @returns Maximum text buffer length
 */
export function getMaxTextBufferLength(version: ZMachineVersion): number {
  if (version <= ZMachineVersion.V4) {
    // One byte for max length, one for actual length, and a zero terminator
    return 255 - 2;
  } else {
    // One byte for max length, one for actual length
    return 255 - 1;
  }
}

/**
 * Gets whether the version stores text with length prefix or zero terminator
 * @param version Z-machine version
 * @returns True if text uses length prefixes instead of zero terminators
 */
export function usesLengthPrefixedText(version: ZMachineVersion): boolean {
  return version >= ZMachineVersion.V5;
}
