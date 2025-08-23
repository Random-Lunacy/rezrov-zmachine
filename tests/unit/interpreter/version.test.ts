import { describe, expect, it } from 'vitest';
import {
  ZMachineVersion,
  byteToPackedAddress,
  getMaxFileSize,
  getMaxTextBufferLength,
  getVersionCapabilities,
  isAddressAligned,
  requiresNonZeroOffsets,
  unpackRoutineAddress,
  unpackStringAddress,
  usesLengthPrefixedText,
  versionSupports,
} from '../../../src/interpreter/Version';

describe('Version capabilities', () => {
  it('should return correct capabilities for V1, V2, and V3', () => {
    const v1Capabilities = getVersionCapabilities(ZMachineVersion.V1);
    const v2Capabilities = getVersionCapabilities(ZMachineVersion.V2);
    const v3Capabilities = getVersionCapabilities(ZMachineVersion.V3);

    // V1, V2, and V3 should have identical capabilities
    expect(v1Capabilities).toEqual(v2Capabilities);
    expect(v2Capabilities).toEqual(v3Capabilities);

    // Verify specific values according to Z-Machine 1.1 spec
    expect(v1Capabilities.maxObjects).toBe(255);
    expect(v1Capabilities.attributeCount).toBe(32);
    expect(v1Capabilities.propertyDefaultsTableSize).toBe(31);
    expect(v1Capabilities.objectEntrySize).toBe(9);
    expect(v1Capabilities.objectEntryOffset).toBe(62);
    expect(v1Capabilities.extendedOpcodes).toBe(false);
    expect(v1Capabilities.variableLengthObjects).toBe(false);
    expect(v1Capabilities.unicodeSupport).toBe(false);
    expect(v1Capabilities.hasPictures).toBe(false);
    expect(v1Capabilities.hasSound).toBe(false);
    expect(v1Capabilities.hasUndoSupport).toBe(false);
  });

  it('should return correct capabilities for V4 and V5', () => {
    const v4Capabilities = getVersionCapabilities(ZMachineVersion.V4);
    const v5Capabilities = getVersionCapabilities(ZMachineVersion.V5);

    // Common capabilities between V4 and V5
    expect(v4Capabilities.maxObjects).toBe(65535);
    expect(v4Capabilities.attributeCount).toBe(48);
    expect(v4Capabilities.propertyDefaultsTableSize).toBe(63);
    expect(v4Capabilities.objectEntrySize).toBe(14);
    expect(v4Capabilities.objectEntryOffset).toBe(126);
    expect(v4Capabilities.extendedOpcodes).toBe(true);
    expect(v4Capabilities.variableLengthObjects).toBe(true);
    expect(v4Capabilities.unicodeSupport).toBe(false);

    // Differences between V4 and V5
    expect(v4Capabilities.hasPictures).toBe(false);
    expect(v5Capabilities.hasPictures).toBe(true);

    expect(v4Capabilities.hasSound).toBe(false);
    expect(v5Capabilities.hasSound).toBe(true);

    expect(v4Capabilities.hasUndoSupport).toBe(false);
    expect(v5Capabilities.hasUndoSupport).toBe(true);
  });

  it('should return correct capabilities for V6 and V7', () => {
    const v6Capabilities = getVersionCapabilities(ZMachineVersion.V6);
    const v7Capabilities = getVersionCapabilities(ZMachineVersion.V7);

    // Common capabilities between V6 and V7
    expect(v6Capabilities.maxObjects).toBe(65535);
    expect(v6Capabilities.attributeCount).toBe(48);
    expect(v6Capabilities.propertyDefaultsTableSize).toBe(63);
    expect(v6Capabilities.objectEntrySize).toBe(14);
    expect(v6Capabilities.objectEntryOffset).toBe(126);
    expect(v6Capabilities.extendedOpcodes).toBe(true);
    expect(v6Capabilities.variableLengthObjects).toBe(true);
    expect(v6Capabilities.hasSound).toBe(true);
    expect(v6Capabilities.hasUndoSupport).toBe(true);

    // Differences between V6 and V7
    expect(v6Capabilities.unicodeSupport).toBe(false);
    expect(v7Capabilities.unicodeSupport).toBe(true);

    expect(v6Capabilities.hasPictures).toBe(true);
    expect(v7Capabilities.hasPictures).toBe(false);
  });

  it('should return correct capabilities for V8', () => {
    const v8Capabilities = getVersionCapabilities(ZMachineVersion.V8);

    expect(v8Capabilities.maxObjects).toBe(65535);
    expect(v8Capabilities.attributeCount).toBe(48);
    expect(v8Capabilities.propertyDefaultsTableSize).toBe(63);
    expect(v8Capabilities.objectEntrySize).toBe(14);
    expect(v8Capabilities.objectEntryOffset).toBe(126);
    expect(v8Capabilities.extendedOpcodes).toBe(true);
    expect(v8Capabilities.variableLengthObjects).toBe(true);
    expect(v8Capabilities.unicodeSupport).toBe(true);
    expect(v8Capabilities.hasPictures).toBe(false);
    expect(v8Capabilities.hasSound).toBe(true);
    expect(v8Capabilities.hasUndoSupport).toBe(true);
  });
});

describe('versionSupports', () => {
  it('should correctly determine feature support for V1-V3', () => {
    expect(versionSupports(ZMachineVersion.V1, 'extendedOpcodes')).toBe(false);
    expect(versionSupports(ZMachineVersion.V2, 'variableLengthObjects')).toBe(false);
    expect(versionSupports(ZMachineVersion.V3, 'unicodeSupport')).toBe(false);
  });

  it('should correctly determine feature support for V4-V5', () => {
    expect(versionSupports(ZMachineVersion.V4, 'extendedOpcodes')).toBe(true);
    expect(versionSupports(ZMachineVersion.V5, 'variableLengthObjects')).toBe(true);
    expect(versionSupports(ZMachineVersion.V4, 'unicodeSupport')).toBe(false);
    expect(versionSupports(ZMachineVersion.V5, 'hasPictures')).toBe(true);
  });

  it('should correctly determine feature support for V6-V8', () => {
    expect(versionSupports(ZMachineVersion.V6, 'unicodeSupport')).toBe(false);
    expect(versionSupports(ZMachineVersion.V7, 'unicodeSupport')).toBe(true);
    expect(versionSupports(ZMachineVersion.V8, 'unicodeSupport')).toBe(true);

    expect(versionSupports(ZMachineVersion.V6, 'hasPictures')).toBe(true);
    expect(versionSupports(ZMachineVersion.V7, 'hasPictures')).toBe(false);
    expect(versionSupports(ZMachineVersion.V8, 'hasPictures')).toBe(false);
  });
});

describe('Address unpacking', () => {
  it('should correctly unpack routine addresses for all versions', () => {
    // V1-V3: address * 2
    expect(unpackRoutineAddress(ZMachineVersion.V1, 0x1234)).toBe(0x2468);
    expect(unpackRoutineAddress(ZMachineVersion.V2, 0x1234)).toBe(0x2468);
    expect(unpackRoutineAddress(ZMachineVersion.V3, 0x1234)).toBe(0x2468);

    // V4-V5: address * 4
    expect(unpackRoutineAddress(ZMachineVersion.V4, 0x1234)).toBe(0x48d0);
    expect(unpackRoutineAddress(ZMachineVersion.V5, 0x1234)).toBe(0x48d0);

    // V6-V7: address * 4 + routineOffset
    expect(unpackRoutineAddress(ZMachineVersion.V6, 0x1234)).toBe(0x48d0); // default routineOffset = 0
    expect(unpackRoutineAddress(ZMachineVersion.V6, 0x1234, 0x100)).toBe(0x49d0);
    expect(unpackRoutineAddress(ZMachineVersion.V7, 0x1234, 0x200)).toBe(0x4ad0);

    // V8: address * 8
    expect(unpackRoutineAddress(ZMachineVersion.V8, 0x1234)).toBe(0x91a0);
  });

  it('should correctly unpack string addresses for all versions', () => {
    // V1-V3: address * 2
    expect(unpackStringAddress(ZMachineVersion.V1, 0x1234)).toBe(0x2468);
    expect(unpackStringAddress(ZMachineVersion.V2, 0x1234)).toBe(0x2468);
    expect(unpackStringAddress(ZMachineVersion.V3, 0x1234)).toBe(0x2468);

    // V4-V5: address * 4
    expect(unpackStringAddress(ZMachineVersion.V4, 0x1234)).toBe(0x48d0);
    expect(unpackStringAddress(ZMachineVersion.V5, 0x1234)).toBe(0x48d0);

    // V6-V7: address * 4 + stringOffset
    expect(unpackStringAddress(ZMachineVersion.V6, 0x1234)).toBe(0x48d0); // default stringOffset = 0
    expect(unpackStringAddress(ZMachineVersion.V6, 0x1234, 0x100)).toBe(0x49d0);
    expect(unpackStringAddress(ZMachineVersion.V7, 0x1234, 0x200)).toBe(0x4ad0);

    // V8: address * 8
    expect(unpackStringAddress(ZMachineVersion.V8, 0x1234)).toBe(0x91a0);
  });
});

describe('Text handling', () => {
  it('should return correct max text buffer lengths', () => {
    // V1-V4: 255 - 2 bytes (one for max length, one for actual length, plus zero terminator)
    expect(getMaxTextBufferLength(ZMachineVersion.V1)).toBe(253);
    expect(getMaxTextBufferLength(ZMachineVersion.V2)).toBe(253);
    expect(getMaxTextBufferLength(ZMachineVersion.V3)).toBe(253);
    expect(getMaxTextBufferLength(ZMachineVersion.V4)).toBe(253);

    // V5-V8: 255 - 1 byte (one for max length, one for actual length)
    expect(getMaxTextBufferLength(ZMachineVersion.V5)).toBe(254);
    expect(getMaxTextBufferLength(ZMachineVersion.V6)).toBe(254);
    expect(getMaxTextBufferLength(ZMachineVersion.V7)).toBe(254);
    expect(getMaxTextBufferLength(ZMachineVersion.V8)).toBe(254);
  });

  it('should determine if version uses length prefixed text', () => {
    // V1-V4 use zero terminators
    expect(usesLengthPrefixedText(ZMachineVersion.V1)).toBe(false);
    expect(usesLengthPrefixedText(ZMachineVersion.V2)).toBe(false);
    expect(usesLengthPrefixedText(ZMachineVersion.V3)).toBe(false);
    expect(usesLengthPrefixedText(ZMachineVersion.V4)).toBe(false);

    // V5-V8 use length prefixes
    expect(usesLengthPrefixedText(ZMachineVersion.V5)).toBe(true);
    expect(usesLengthPrefixedText(ZMachineVersion.V6)).toBe(true);
    expect(usesLengthPrefixedText(ZMachineVersion.V7)).toBe(true);
    expect(usesLengthPrefixedText(ZMachineVersion.V8)).toBe(true);
  });
});

describe('Address alignment checking', () => {
  it('should validate alignment for V1-V3', () => {
    // In V1-V3, addresses must be aligned on 2-byte boundaries
    expect(isAddressAligned(ZMachineVersion.V1, 0)).toBe(true);
    expect(isAddressAligned(ZMachineVersion.V1, 2)).toBe(true);
    expect(isAddressAligned(ZMachineVersion.V1, 4)).toBe(true);
    expect(isAddressAligned(ZMachineVersion.V1, 1)).toBe(false);
    expect(isAddressAligned(ZMachineVersion.V1, 3)).toBe(false);

    expect(isAddressAligned(ZMachineVersion.V2, 0)).toBe(true);
    expect(isAddressAligned(ZMachineVersion.V2, 2)).toBe(true);
    expect(isAddressAligned(ZMachineVersion.V2, 4)).toBe(true);
    expect(isAddressAligned(ZMachineVersion.V2, 1)).toBe(false);
    expect(isAddressAligned(ZMachineVersion.V2, 3)).toBe(false);

    expect(isAddressAligned(ZMachineVersion.V3, 0)).toBe(true);
    expect(isAddressAligned(ZMachineVersion.V3, 2)).toBe(true);
    expect(isAddressAligned(ZMachineVersion.V3, 4)).toBe(true);
    expect(isAddressAligned(ZMachineVersion.V3, 1)).toBe(false);
    expect(isAddressAligned(ZMachineVersion.V3, 3)).toBe(false);
  });

  it('should validate alignment for V4-V5', () => {
    // In V4-V5, addresses must be aligned on 4-byte boundaries
    expect(isAddressAligned(ZMachineVersion.V4, 0)).toBe(true);
    expect(isAddressAligned(ZMachineVersion.V4, 4)).toBe(true);
    expect(isAddressAligned(ZMachineVersion.V4, 8)).toBe(true);
    expect(isAddressAligned(ZMachineVersion.V4, 1)).toBe(false);
    expect(isAddressAligned(ZMachineVersion.V4, 2)).toBe(false);
    expect(isAddressAligned(ZMachineVersion.V4, 3)).toBe(false);

    expect(isAddressAligned(ZMachineVersion.V5, 0)).toBe(true);
    expect(isAddressAligned(ZMachineVersion.V5, 4)).toBe(true);
    expect(isAddressAligned(ZMachineVersion.V5, 8)).toBe(true);
    expect(isAddressAligned(ZMachineVersion.V5, 1)).toBe(false);
    expect(isAddressAligned(ZMachineVersion.V5, 2)).toBe(false);
    expect(isAddressAligned(ZMachineVersion.V5, 3)).toBe(false);
  });

  it('should validate alignment for V6-V7 with offsets', () => {
    // In V6-V7, addresses must be aligned on 4-byte boundaries relative to offset
    const routineOffset = 0x100;
    const stringOffset = 0x200;

    // Routine addresses (relative to routine offset)
    expect(isAddressAligned(ZMachineVersion.V6, 0x100, true, routineOffset)).toBe(true);
    expect(isAddressAligned(ZMachineVersion.V6, 0x104, true, routineOffset)).toBe(true);
    expect(isAddressAligned(ZMachineVersion.V6, 0x108, true, routineOffset)).toBe(true);
    expect(isAddressAligned(ZMachineVersion.V6, 0x101, true, routineOffset)).toBe(false);
    expect(isAddressAligned(ZMachineVersion.V6, 0x102, true, routineOffset)).toBe(false);
    expect(isAddressAligned(ZMachineVersion.V6, 0x103, true, routineOffset)).toBe(false);

    // String addresses (relative to string offset)
    expect(isAddressAligned(ZMachineVersion.V6, 0x200, false, routineOffset, stringOffset)).toBe(true);
    expect(isAddressAligned(ZMachineVersion.V6, 0x204, false, routineOffset, stringOffset)).toBe(true);
    expect(isAddressAligned(ZMachineVersion.V6, 0x208, false, routineOffset, stringOffset)).toBe(true);
    expect(isAddressAligned(ZMachineVersion.V6, 0x201, false, routineOffset, stringOffset)).toBe(false);
    expect(isAddressAligned(ZMachineVersion.V6, 0x202, false, routineOffset, stringOffset)).toBe(false);
    expect(isAddressAligned(ZMachineVersion.V6, 0x203, false, routineOffset, stringOffset)).toBe(false);

    // Same for V7
    expect(isAddressAligned(ZMachineVersion.V7, 0x100, true, routineOffset)).toBe(true);
    expect(isAddressAligned(ZMachineVersion.V7, 0x104, true, routineOffset)).toBe(true);
    expect(isAddressAligned(ZMachineVersion.V7, 0x108, true, routineOffset)).toBe(true);
    expect(isAddressAligned(ZMachineVersion.V7, 0x101, true, routineOffset)).toBe(false);

    // String addresses (relative to string offset)
    expect(isAddressAligned(ZMachineVersion.V7, 0x200, false, routineOffset, stringOffset)).toBe(true);
    expect(isAddressAligned(ZMachineVersion.V7, 0x204, false, routineOffset, stringOffset)).toBe(true);
    expect(isAddressAligned(ZMachineVersion.V7, 0x208, false, routineOffset, stringOffset)).toBe(true);
    expect(isAddressAligned(ZMachineVersion.V7, 0x201, false, routineOffset, stringOffset)).toBe(false);
  });

  it('should validate alignment for V8', () => {
    // In V8, addresses must be aligned on 8-byte boundaries
    expect(isAddressAligned(ZMachineVersion.V8, 0)).toBe(true);
    expect(isAddressAligned(ZMachineVersion.V8, 8)).toBe(true);
    expect(isAddressAligned(ZMachineVersion.V8, 16)).toBe(true);
    expect(isAddressAligned(ZMachineVersion.V8, 1)).toBe(false);
    expect(isAddressAligned(ZMachineVersion.V8, 2)).toBe(false);
    expect(isAddressAligned(ZMachineVersion.V8, 3)).toBe(false);
    expect(isAddressAligned(ZMachineVersion.V8, 4)).toBe(false);
    expect(isAddressAligned(ZMachineVersion.V8, 5)).toBe(false);
    expect(isAddressAligned(ZMachineVersion.V8, 6)).toBe(false);
    expect(isAddressAligned(ZMachineVersion.V8, 7)).toBe(false);
  });
});

describe('Byte to packed address conversion', () => {
  it('should convert byte addresses to packed addresses for V1-V3', () => {
    // V1-V3: divide by 2
    expect(byteToPackedAddress(ZMachineVersion.V1, 0)).toBe(0);
    expect(byteToPackedAddress(ZMachineVersion.V1, 2)).toBe(1);
    expect(byteToPackedAddress(ZMachineVersion.V1, 4)).toBe(2);
    expect(byteToPackedAddress(ZMachineVersion.V1, 1000)).toBe(500);

    expect(byteToPackedAddress(ZMachineVersion.V2, 0)).toBe(0);
    expect(byteToPackedAddress(ZMachineVersion.V2, 2)).toBe(1);
    expect(byteToPackedAddress(ZMachineVersion.V2, 4)).toBe(2);
    expect(byteToPackedAddress(ZMachineVersion.V2, 1000)).toBe(500);

    expect(byteToPackedAddress(ZMachineVersion.V3, 0)).toBe(0);
    expect(byteToPackedAddress(ZMachineVersion.V3, 2)).toBe(1);
    expect(byteToPackedAddress(ZMachineVersion.V3, 4)).toBe(2);
    expect(byteToPackedAddress(ZMachineVersion.V3, 1000)).toBe(500);
  });

  it('should convert byte addresses to packed addresses for V4-V5', () => {
    // V4-V5: divide by 4
    expect(byteToPackedAddress(ZMachineVersion.V4, 0)).toBe(0);
    expect(byteToPackedAddress(ZMachineVersion.V4, 4)).toBe(1);
    expect(byteToPackedAddress(ZMachineVersion.V4, 8)).toBe(2);
    expect(byteToPackedAddress(ZMachineVersion.V4, 1000)).toBe(250);

    expect(byteToPackedAddress(ZMachineVersion.V5, 0)).toBe(0);
    expect(byteToPackedAddress(ZMachineVersion.V5, 4)).toBe(1);
    expect(byteToPackedAddress(ZMachineVersion.V5, 8)).toBe(2);
    expect(byteToPackedAddress(ZMachineVersion.V5, 1000)).toBe(250);
  });

  it('should convert byte addresses to packed addresses for V6-V7 with offsets', () => {
    // V6-V7: (address - offset) / 4
    const routineOffset = 0x100;
    const stringOffset = 0x200;

    // Routine addresses
    expect(byteToPackedAddress(ZMachineVersion.V6, 0x100, true, routineOffset)).toBe(0);
    expect(byteToPackedAddress(ZMachineVersion.V6, 0x104, true, routineOffset)).toBe(1);
    expect(byteToPackedAddress(ZMachineVersion.V6, 0x108, true, routineOffset)).toBe(2);
    expect(byteToPackedAddress(ZMachineVersion.V6, 0x200, true, routineOffset)).toBe(64); // (0x200 - 0x100) / 4 = 64

    // String addresses
    expect(byteToPackedAddress(ZMachineVersion.V6, 0x200, false, routineOffset, stringOffset)).toBe(0);
    expect(byteToPackedAddress(ZMachineVersion.V6, 0x204, false, routineOffset, stringOffset)).toBe(1);
    expect(byteToPackedAddress(ZMachineVersion.V6, 0x208, false, routineOffset, stringOffset)).toBe(2);
    expect(byteToPackedAddress(ZMachineVersion.V6, 0x300, false, routineOffset, stringOffset)).toBe(64); // (0x300 - 0x200) / 4 = 64

    // Same tests for V7
    expect(byteToPackedAddress(ZMachineVersion.V7, 0x100, true, routineOffset)).toBe(0);
    expect(byteToPackedAddress(ZMachineVersion.V7, 0x104, true, routineOffset)).toBe(1);
    expect(byteToPackedAddress(ZMachineVersion.V7, 0x108, true, routineOffset)).toBe(2);
    expect(byteToPackedAddress(ZMachineVersion.V7, 0x200, true, routineOffset)).toBe(64);

    expect(byteToPackedAddress(ZMachineVersion.V7, 0x200, false, routineOffset, stringOffset)).toBe(0);
    expect(byteToPackedAddress(ZMachineVersion.V7, 0x204, false, routineOffset, stringOffset)).toBe(1);
    expect(byteToPackedAddress(ZMachineVersion.V7, 0x208, false, routineOffset, stringOffset)).toBe(2);
    expect(byteToPackedAddress(ZMachineVersion.V7, 0x300, false, routineOffset, stringOffset)).toBe(64);
  });

  it('should convert byte addresses to packed addresses for V8', () => {
    // V8: divide by 8
    expect(byteToPackedAddress(ZMachineVersion.V8, 0)).toBe(0);
    expect(byteToPackedAddress(ZMachineVersion.V8, 8)).toBe(1);
    expect(byteToPackedAddress(ZMachineVersion.V8, 16)).toBe(2);
    expect(byteToPackedAddress(ZMachineVersion.V8, 1000)).toBe(125);
  });

  it('should throw errors for misaligned addresses', () => {
    // Misaligned addresses should fail
    expect(() => byteToPackedAddress(ZMachineVersion.V1, 1)).toThrow('not properly aligned');
    expect(() => byteToPackedAddress(ZMachineVersion.V3, 3)).toThrow('not properly aligned');
    expect(() => byteToPackedAddress(ZMachineVersion.V4, 2)).toThrow('not properly aligned');
    expect(() => byteToPackedAddress(ZMachineVersion.V5, 6)).toThrow('not properly aligned');

    const routineOffset = 0x100;
    const stringOffset = 0x200;
    expect(() => byteToPackedAddress(ZMachineVersion.V6, 0x102, true, routineOffset)).toThrow('not properly aligned');
    expect(() => byteToPackedAddress(ZMachineVersion.V6, 0x201, false, routineOffset, stringOffset)).toThrow(
      'not properly aligned'
    );

    expect(() => byteToPackedAddress(ZMachineVersion.V8, 4)).toThrow('not properly aligned');
  });
});

describe('Maximum file size', () => {
  it('should return correct maximum file size for all versions', () => {
    // V1-V2: 128KB
    expect(getMaxFileSize(ZMachineVersion.V1)).toBe(128 * 1024);
    expect(getMaxFileSize(ZMachineVersion.V2)).toBe(128 * 1024);

    // V3-V4: 256KB
    expect(getMaxFileSize(ZMachineVersion.V3)).toBe(256 * 1024);
    expect(getMaxFileSize(ZMachineVersion.V4)).toBe(256 * 1024);

    // V5-V8: 512KB
    expect(getMaxFileSize(ZMachineVersion.V5)).toBe(512 * 1024);
    expect(getMaxFileSize(ZMachineVersion.V6)).toBe(512 * 1024);
    expect(getMaxFileSize(ZMachineVersion.V7)).toBe(512 * 1024);
    expect(getMaxFileSize(ZMachineVersion.V8)).toBe(512 * 1024);
  });
});

describe('Non-zero offset requirements', () => {
  it('should correctly identify versions requiring non-zero offsets', () => {
    // Only V6 and V7 require non-zero offsets
    expect(requiresNonZeroOffsets(ZMachineVersion.V1)).toBe(false);
    expect(requiresNonZeroOffsets(ZMachineVersion.V2)).toBe(false);
    expect(requiresNonZeroOffsets(ZMachineVersion.V3)).toBe(false);
    expect(requiresNonZeroOffsets(ZMachineVersion.V4)).toBe(false);
    expect(requiresNonZeroOffsets(ZMachineVersion.V5)).toBe(false);
    expect(requiresNonZeroOffsets(ZMachineVersion.V6)).toBe(true);
    expect(requiresNonZeroOffsets(ZMachineVersion.V7)).toBe(true);
    expect(requiresNonZeroOffsets(ZMachineVersion.V8)).toBe(false);
  });
});

describe('Address unpacking and packing roundtrip', () => {
  it('should correctly round-trip between packed and byte addresses for all versions', () => {
    // Test round-trip conversion for V1-V3
    for (const version of [ZMachineVersion.V1, ZMachineVersion.V2, ZMachineVersion.V3]) {
      for (const byteAddr of [0, 2, 4, 100, 1000, 32000]) {
        const packedAddr = byteToPackedAddress(version, byteAddr);
        const roundTrip = unpackRoutineAddress(version, packedAddr);
        expect(roundTrip).toBe(byteAddr);
      }
    }

    // Test round-trip conversion for V4-V5
    for (const version of [ZMachineVersion.V4, ZMachineVersion.V5]) {
      for (const byteAddr of [0, 4, 8, 100, 1000, 32000]) {
        const packedAddr = byteToPackedAddress(version, byteAddr);
        const roundTrip = unpackRoutineAddress(version, packedAddr);
        expect(roundTrip).toBe(byteAddr);
      }
    }

    // Test round-trip conversion for V6-V7 with offsets
    for (const version of [ZMachineVersion.V6, ZMachineVersion.V7]) {
      const routineOffset = 0x100;
      const stringOffset = 0x200;

      // Routine addresses
      for (const byteAddr of [0x100, 0x104, 0x108, 0x200, 0x1000]) {
        const packedAddr = byteToPackedAddress(version, byteAddr, true, routineOffset);
        const roundTrip = unpackRoutineAddress(version, packedAddr, routineOffset);
        expect(roundTrip).toBe(byteAddr);
      }

      // String addresses
      for (const byteAddr of [0x200, 0x204, 0x208, 0x300, 0x1000]) {
        const packedAddr = byteToPackedAddress(version, byteAddr, false, routineOffset, stringOffset);
        const roundTrip = unpackStringAddress(version, packedAddr, stringOffset);
        expect(roundTrip).toBe(byteAddr);
      }
    }

    // Test round-trip conversion for V8
    for (const byteAddr of [0, 8, 16, 24, 1000, 32000]) {
      const packedAddr = byteToPackedAddress(ZMachineVersion.V8, byteAddr);
      const roundTrip = unpackRoutineAddress(ZMachineVersion.V8, packedAddr);
      expect(roundTrip).toBe(byteAddr);
    }
  });
});
