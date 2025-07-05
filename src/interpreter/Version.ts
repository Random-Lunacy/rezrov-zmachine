import {
  MAX_ATTRIBUTES_V3,
  MAX_ATTRIBUTES_V4,
  MAX_OBJECTS_V3,
  MAX_OBJECTS_V4,
  MAX_PROPERTIES_V3,
  MAX_PROPERTIES_V4,
} from '../utils/constants';

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
        maxObjects: MAX_OBJECTS_V3,
        attributeCount: MAX_ATTRIBUTES_V3,
        propertyDefaultsTableSize: MAX_PROPERTIES_V3,
        objectEntrySize: 9,
        objectEntryOffset: MAX_PROPERTIES_V3 * 2,
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
        maxObjects: MAX_OBJECTS_V4,
        attributeCount: MAX_ATTRIBUTES_V4,
        propertyDefaultsTableSize: MAX_PROPERTIES_V4,
        objectEntrySize: 14,
        objectEntryOffset: MAX_PROPERTIES_V4 * 2,
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
        maxObjects: MAX_OBJECTS_V4, // Same as V4-V5
        attributeCount: MAX_ATTRIBUTES_V4, // Same as V4-V5
        propertyDefaultsTableSize: MAX_PROPERTIES_V4, // Same as V4-V5
        objectEntrySize: 14,
        objectEntryOffset: MAX_PROPERTIES_V4 * 2,
        extendedOpcodes: true,
        variableLengthObjects: true,
        unicodeSupport: version === ZMachineVersion.V7,
        hasPictures: version === ZMachineVersion.V6,
        hasSound: true,
        hasUndoSupport: true,
      };
    case ZMachineVersion.V8:
      return {
        maxObjects: MAX_OBJECTS_V4, // Same as V4-V5
        attributeCount: MAX_ATTRIBUTES_V4, // Same as V4-V5
        propertyDefaultsTableSize: MAX_PROPERTIES_V4, // Same as V4-V5
        objectEntrySize: 14,
        objectEntryOffset: MAX_PROPERTIES_V4 * 2,
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
export function unpackRoutineAddress(version: ZMachineVersion, packedAddr: number, routineOffset: number = 0): number {
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
export function unpackStringAddress(version: ZMachineVersion, packedAddr: number, stringOffset: number = 0): number {
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

/**
 * Checks if a byte address is properly aligned for the given Z-machine version
 * @param version Z-machine version
 * @param byteAddr Byte address to check
 * @param isRoutine Whether this is a routine address (vs. string address)
 * @param routineOffset Routine offset for V6-7 (if applicable)
 * @param stringOffset String offset for V6-7 (if applicable)
 * @returns True if the address is properly aligned
 */
export function isAddressAligned(
  version: ZMachineVersion,
  byteAddr: number,
  isRoutine: boolean = true,
  routineOffset: number = 0,
  stringOffset: number = 0
): boolean {
  // Check alignment requirements based on version
  if (version <= ZMachineVersion.V3) {
    // Must be on a 2-byte boundary
    return byteAddr % 2 === 0;
  } else if (version <= ZMachineVersion.V5) {
    // Must be on a 4-byte boundary
    return byteAddr % 4 === 0;
  } else if (version <= ZMachineVersion.V7) {
    // Must be on a 4-byte boundary relative to the offset
    const offset = isRoutine ? routineOffset : stringOffset;
    return (byteAddr - offset) % 4 === 0;
  } else if (version === ZMachineVersion.V8) {
    // Must be on an 8-byte boundary
    return byteAddr % 8 === 0;
  } else {
    throw new Error(`Unknown Z-machine version: ${version}`);
  }
}

/**
 * Converts a byte address to a packed address
 * @param version Z-machine version
 * @param byteAddr Byte address to convert
 * @param isRoutine Whether this is a routine address (vs. string address)
 * @param routineOffset Routine offset for V6-7 (if applicable)
 * @param stringOffset String offset for V6-7 (if applicable)
 * @returns Packed address
 */
export function byteToPackedAddress(
  version: ZMachineVersion,
  byteAddr: number,
  isRoutine: boolean = true,
  routineOffset: number = 0,
  stringOffset: number = 0
): number {
  if (!isAddressAligned(version, byteAddr, isRoutine, routineOffset, stringOffset)) {
    throw new Error(`Address 0x${byteAddr.toString(16)} is not properly aligned for packed address`);
  }

  if (version <= ZMachineVersion.V3) {
    return Math.floor(byteAddr / 2);
  } else if (version <= ZMachineVersion.V5) {
    return Math.floor(byteAddr / 4);
  } else if (version <= ZMachineVersion.V7) {
    const offset = isRoutine ? routineOffset : stringOffset;
    return Math.floor((byteAddr - offset) / 4);
  } else if (version === ZMachineVersion.V8) {
    return Math.floor(byteAddr / 8);
  } else {
    throw new Error(`Unknown Z-machine version: ${version}`);
  }
}

/**
 * Gets the maximum file size for a specific Z-machine version
 * @param version Z-machine version
 * @returns Maximum file size in bytes
 */
export function getMaxFileSize(version: ZMachineVersion): number {
  if (version <= ZMachineVersion.V3) return 128 * 1024;
  if (version <= ZMachineVersion.V5) return 256 * 1024;
  return 512 * 1024;
}

/**
 * Checks if a Z-machine version requires non-zero routine and string offsets
 * @param version Z-machine version
 * @returns True if the version requires non-zero offsets
 */
export function requiresNonZeroOffsets(version: ZMachineVersion): boolean {
  return version === ZMachineVersion.V6 || version === ZMachineVersion.V7;
}
