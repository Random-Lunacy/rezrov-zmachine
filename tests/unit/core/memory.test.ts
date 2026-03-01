import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import { Memory } from '../../../src/core/memory/Memory';
import { AlphabetTableManager } from '../../../src/parsers/AlphabetTable';
import { HeaderLocation } from '../../../src/utils/constants';
import { Logger } from '../../../src/utils/log';

describe('Memory', () => {
  let mockBuffer: Buffer;
  let mockLogger: Logger;

  beforeEach(() => {
    mockBuffer = Buffer.alloc(0x10000);
    mockLogger = new Logger('TestLogger');
    mockLogger.warn = vi.fn();
    mockLogger.error = vi.fn();
    mockLogger.debug = vi.fn();

    // Set up a minimal valid header for testing
    mockBuffer[HeaderLocation.Version] = 3;
    mockBuffer.writeUInt16BE(0x0400, HeaderLocation.StaticMemBase);
    mockBuffer.writeUInt16BE(0x0800, HeaderLocation.HighMemBase);
  });

  describe('Initialization', () => {
    it('should initialize memory with valid configuration', () => {
      const memory = new Memory(mockBuffer, { logger: mockLogger });

      expect(memory.version).toBe(3);
      expect(memory.dynamicMemoryEnd).toBe(0x0400);
      expect(memory.highMemoryStart).toBe(0x0800);
      expect(mockLogger.debug).toHaveBeenCalledWith('Memory map validated successfully for version 3');
    });

    it('should skip validation when skipValidation is true', () => {
      mockBuffer[HeaderLocation.Version] = 0;
      mockBuffer.writeUInt16BE(0x0000, HeaderLocation.StaticMemBase);

      const memory = new Memory(mockBuffer, { logger: mockLogger, skipValidation: true });

      expect(memory.version).toBe(0);
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it('should throw an error for invalid Z-machine version', () => {
      mockBuffer[HeaderLocation.Version] = 9;

      expect(() => new Memory(mockBuffer, { logger: mockLogger })).toThrow('Invalid Z-machine version: 9');
    });

    it('should throw an error for dynamic memory size less than minimum', () => {
      mockBuffer[HeaderLocation.Version] = 3;
      mockBuffer.writeUInt16BE(0x0030, HeaderLocation.StaticMemBase);

      expect(() => new Memory(mockBuffer, { logger: mockLogger })).toThrow(
        'Dynamic memory size is less than minimum (64 bytes): 48'
      );
    });

    it('should throw an error when high memory overlaps static memory', () => {
      mockBuffer[HeaderLocation.Version] = 3;
      mockBuffer.writeUInt16BE(0x0400, HeaderLocation.StaticMemBase);
      mockBuffer.writeUInt16BE(0x0300, HeaderLocation.HighMemBase);

      expect(() => new Memory(mockBuffer, { logger: mockLogger })).toThrow(
        'High memory start (768) must be >= static memory end (1024)'
      );
    });

    it('should load alphabet table manager for version >= 1', () => {
      mockBuffer[HeaderLocation.Version] = 5;

      // Mock the AlphabetTableManager
      const mockAlphabetManager = { getAlphabetTables: vi.fn().mockReturnValue(['test1', 'test2', 'test3']) };
      vi.spyOn(AlphabetTableManager.prototype, 'getAlphabetTables').mockImplementation(() => [
        'test1',
        'test2',
        'test3',
      ]);

      const memory = new Memory(mockBuffer, { logger: mockLogger });

      expect(memory.getAlphabetTables()).toEqual(['test1', 'test2', 'test3']);

      vi.restoreAllMocks();
    });
  });

  describe('Memory Regions', () => {
    let memory: Memory;

    beforeEach(() => {
      memory = new Memory(mockBuffer, { logger: mockLogger });
    });

    it('correctly identifies memory regions', () => {
      // Dynamic memory region
      expect(memory.isDynamicMemory(0x100)).toBe(true);
      expect(memory.isDynamicMemory(0x3ff)).toBe(true);
      expect(memory.isDynamicMemory(0x400)).toBe(false);

      // Static memory region
      expect(memory.isStaticMemory(0x3ff)).toBe(false);
      expect(memory.isStaticMemory(0x400)).toBe(true);
      expect(memory.isStaticMemory(0x7ff)).toBe(true);
      expect(memory.isStaticMemory(0x800)).toBe(false);

      // High memory region
      expect(memory.isHighMemory(0x7ff)).toBe(false);
      expect(memory.isHighMemory(0x800)).toBe(true);
      expect(memory.isHighMemory(0xffff)).toBe(true);
    });

    it('correctly handles region boundaries', () => {
      // Test exactly at boundaries
      expect(memory.isDynamicMemory(0x400 - 1)).toBe(true);
      expect(memory.isDynamicMemory(0x400)).toBe(false);

      expect(memory.isStaticMemory(0x400)).toBe(true);
      expect(memory.isStaticMemory(0x800 - 1)).toBe(true);
      expect(memory.isStaticMemory(0x800)).toBe(false);

      expect(memory.isHighMemory(0x800)).toBe(true);
      expect(memory.isHighMemory(0x800 - 1)).toBe(false);
    });
  });

  describe('Memory Operations', () => {
    let memory: Memory;

    beforeEach(() => {
      memory = new Memory(mockBuffer, { logger: mockLogger });
    });

    it('should handle byte operations correctly', () => {
      // Test setting and getting bytes
      memory.setByte(0x100, 0xaa);
      expect(memory.getByte(0x100)).toBe(0xaa);

      // Test boundary condition
      memory.setByte(0x3ff, 0xbb);
      expect(memory.getByte(0x3ff)).toBe(0xbb);

      // Writing to static memory should warn but not throw (games like Beyond Zork do this)
      memory.setByte(0x400, 0xcc);
      expect(memory.getByte(0x400)).toBe(0xcc);
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('non-dynamic memory'));

      // Test out-of-bounds access
      expect(() => memory.getByte(0x10000)).toThrow(/Memory access out of bounds/);
      expect(() => memory.setByte(0x10000, 0xdd)).toThrow(/Memory access out of bounds/);
    });

    it('should handle word operations correctly', () => {
      // Test setting and getting words
      memory.setWord(0x100, 0xaabb);
      expect(memory.getWord(0x100)).toBe(0xaabb);

      // Check endianness (big-endian)
      expect(memory.getByte(0x100)).toBe(0xaa);
      expect(memory.getByte(0x101)).toBe(0xbb);

      // Test boundary condition
      memory.setWord(0x3fe, 0xccdd);
      expect(memory.getWord(0x3fe)).toBe(0xccdd);

      // Writing to static memory should warn but not throw
      memory.setWord(0x400, 0xeeff);
      expect(memory.getWord(0x400)).toBe(0xeeff);
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('non-dynamic memory'));

      // Straddling dynamic/static boundary should also warn
      mockLogger.warn = vi.fn();
      memory.setWord(0x3ff, 0x1122);
      expect(memory.getWord(0x3ff)).toBe(0x1122);
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('non-dynamic memory'));

      // Test out-of-bounds access
      expect(() => memory.getWord(0xffff)).toThrow(/Memory access out of bounds/);
    });

    it('should copy memory blocks correctly', () => {
      // Setup source data
      for (let i = 0; i < 10; i++) {
        memory.setByte(0x100 + i, i);
      }

      // Non-overlapping copy
      memory.copyBlock(0x100, 0x200, 10);

      for (let i = 0; i < 10; i++) {
        expect(memory.getByte(0x200 + i)).toBe(i);
      }

      // Test overlapping copy (forward direction)
      memory.copyBlock(0x200, 0x204, 6);

      expect(memory.getByte(0x204)).toBe(0);
      expect(memory.getByte(0x205)).toBe(1);

      // Test overlapping copy (backward direction)
      memory.copyBlock(0x204, 0x200, 6);

      expect(memory.getByte(0x200)).toBe(0);
      expect(memory.getByte(0x201)).toBe(1);

      // Copy to static memory should warn but not throw
      mockLogger.warn = vi.fn();
      memory.copyBlock(0x100, 0x400, 10);
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('non-dynamic memory'));
    });

    it('should compare memory blocks correctly', () => {
      // Setup test data
      for (let i = 0; i < 10; i++) {
        memory.setByte(0x100 + i, i);
        memory.setByte(0x200 + i, i);
      }

      // Test identical blocks
      expect(memory.compareBlock(0x100, 0x200, 10)).toBe(0);

      // Test different blocks
      memory.setByte(0x205, 0xff);
      expect(memory.compareBlock(0x100, 0x200, 10)).not.toBe(0);

      // Test comparison with read-only memory
      expect(() => memory.compareBlock(0x100, 0x10000, 10)).toThrow(/Memory access out of bounds/);
    });
  });

  describe('Z-String Operations with Safety Checks', () => {
    let memory: Memory;

    beforeEach(() => {
      memory = new Memory(mockBuffer, { logger: mockLogger });
      // Setup sample Z-string data
      memory.setMemoryForTesting(0x800, Buffer.from([0x48, 0xe5, 0x9c, 0xa5, 0x90, 0xa4, 0x11, 0x42]), true);
    });

    it('should read normal Z-strings correctly', () => {
      const zstr = memory.getZString(0x800);
      expect(zstr).toBeInstanceOf(Array);
      expect(zstr.length).toBeGreaterThan(0);
    });

    it('should handle malformed Z-strings with word count safety limit', () => {
      // Create malformed Z-string in static memory region (valid region, no termination)
      const malformedData = Buffer.alloc(2000, 0);
      memory.setMemoryForTesting(0x500, malformedData, true);

      const zstr = memory.getZString(0x500);

      expect(zstr).toBeInstanceOf(Array);
      expect(zstr.length).toBeLessThanOrEqual(3000); // MAX_WORDS * 3 chars/word
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('exceeded maximum length'));
    });

    it('should handle Z-strings that reach memory bounds safely', () => {
      // Place malformed string near end of memory
      const nearEndAddress = 0xfff0;
      memory.setMemoryForTesting(nearEndAddress, Buffer.from([0x00, 0x00]), true);

      const zstr = memory.getZString(nearEndAddress);

      expect(zstr).toBeInstanceOf(Array);
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('reached memory end'));
    });

    it('should validate memory regions correctly', () => {
      // Test reading from each valid memory region

      // Dynamic memory (< dynamicMemoryEnd)
      const dynamicAddr = 0x100;
      expect(() => memory.getZString(dynamicAddr)).not.toThrow();

      // Static memory (dynamicMemoryEnd <= addr < highMemoryStart)
      const staticAddr = 0x500;
      expect(() => memory.getZString(staticAddr)).not.toThrow();

      // High memory (>= highMemoryStart)
      const highAddr = 0x900;
      expect(() => memory.getZString(highAddr)).not.toThrow();
    });

    it('should throw error for completely out-of-bounds addresses', () => {
      expect(() => memory.getZString(0x10000)).toThrow(/String address out of bounds/);
      expect(() => memory.getZString(-1)).toThrow(/String address out of bounds/);
    });
  });

  describe('Address Handling', () => {
    let memory: Memory;

    beforeEach(() => {
      mockBuffer[HeaderLocation.Version] = 3;
      memory = new Memory(mockBuffer, { logger: mockLogger });
    });

    it('should pack and unpack routine addresses correctly for V3', () => {
      // For V3, packed address is byte address / 2
      const byteAddr = 0x1000;
      const packedAddr = 0x800;

      expect(memory.byteToPackedAddress(0x1000, true)).toBe(0x800);
      expect(memory.packedToByteAddress(0x800, true)).toBe(0x1000);
    });

    it('should validate routine headers', () => {
      // Setup a valid routine header in high memory
      // Routine with 2 locals
      memory.setMemoryForTesting(0x1000, Buffer.from([0x02, 0x00, 0x00, 0x00, 0x00]), true);

      expect(memory.validateRoutineHeader(0x1000)).toBe(true);

      // Invalid routine header (too many locals)
      memory.setMemoryForTesting(0x1100, Buffer.from([0x20]), true);

      expect(memory.validateRoutineHeader(0x1100)).toBe(false);
    });
  });

  describe('Address Validation', () => {
    let memory: Memory;

    beforeEach(() => {
      mockBuffer[HeaderLocation.Version] = 3;
      memory = new Memory(mockBuffer, { logger: mockLogger });
    });

    it('should validate routine addresses correctly', () => {
      // Valid routine addresses (high memory)
      expect(memory.isValidRoutineAddress(0x1000)).toBe(true);
      expect(memory.isValidRoutineAddress(0x800)).toBe(true);
      expect(memory.isValidRoutineAddress(0xffff)).toBe(true);

      // Invalid addresses (dynamic memory)
      expect(memory.isValidRoutineAddress(0x100)).toBe(false);
      expect(memory.isValidRoutineAddress(0x3ff)).toBe(false);

      // Invalid addresses (out of bounds)
      expect(memory.isValidRoutineAddress(0x10000)).toBe(false);

      // Invalid addresses (negative)
      expect(memory.isValidRoutineAddress(-1)).toBe(false);
    });

    it('should check packed address alignment for V3', () => {
      // V3 requires 2-byte alignment
      expect(memory.checkPackedAddressAlignment(0x1000, true)).toBe(true);
      expect(memory.checkPackedAddressAlignment(0x1002, true)).toBe(true);
      expect(memory.checkPackedAddressAlignment(0x1001, true)).toBe(false);
      expect(memory.checkPackedAddressAlignment(0x1003, true)).toBe(false);

      // String addresses also need alignment
      expect(memory.checkPackedAddressAlignment(0x1000, false)).toBe(true);
      expect(memory.checkPackedAddressAlignment(0x1001, false)).toBe(false);
    });

    it('should check packed address alignment for V5', () => {
      mockBuffer[HeaderLocation.Version] = 5;
      memory = new Memory(mockBuffer, { logger: mockLogger });

      // V5 requires 4-byte alignment
      expect(memory.checkPackedAddressAlignment(0x1000, true)).toBe(true);
      expect(memory.checkPackedAddressAlignment(0x1004, true)).toBe(true);
      expect(memory.checkPackedAddressAlignment(0x1001, true)).toBe(false);
      expect(memory.checkPackedAddressAlignment(0x1002, true)).toBe(false);
      expect(memory.checkPackedAddressAlignment(0x1003, true)).toBe(false);
    });
  });

  describe('Packed Address Conversion', () => {
    let memory: Memory;

    beforeEach(() => {
      mockBuffer[HeaderLocation.Version] = 3;
      memory = new Memory(mockBuffer, { logger: mockLogger });
    });

    it('should unpack routine addresses for V3', () => {
      expect(memory.unpackRoutineAddress(0x800)).toBe(0x1000);
      expect(memory.unpackRoutineAddress(0x1000)).toBe(0x2000);
    });

    it('should unpack string addresses for V3', () => {
      expect(memory.unpackStringAddress(0x800)).toBe(0x1000);
      expect(memory.unpackStringAddress(0x1000)).toBe(0x2000);
    });

    it('should handle negative packed addresses', () => {
      expect(() => memory.packedToByteAddress(-1, true)).toThrow(/Invalid negative packed address/);
    });

    it('should handle invalid packed address conversions', () => {
      // Packed address that converts to out-of-bounds byte address
      const largePacked = 0x8000; // Would be 0x10000 for V3
      expect(() => memory.packedToByteAddress(largePacked, true)).toThrow(/converts to invalid byte address/);
    });

    it('should throw error when converting non-high-memory address to packed', () => {
      // Try to convert dynamic memory address
      expect(() => memory.byteToPackedAddress(0x100, true)).toThrow(/is not in high memory/);

      // Try to convert static memory address
      expect(() => memory.byteToPackedAddress(0x500, true)).toThrow(/is not in high memory/);
    });

    it('should pack and unpack addresses for V5', () => {
      mockBuffer[HeaderLocation.Version] = 5;
      memory = new Memory(mockBuffer, { logger: mockLogger });

      // V5 uses 4-byte packing
      const byteAddr = 0x1000;
      const packedAddr = 0x400;

      expect(memory.byteToPackedAddress(byteAddr, true)).toBe(packedAddr);
      expect(memory.packedToByteAddress(packedAddr, true)).toBe(byteAddr);
    });

    it('should pack and unpack addresses for V6/V7 with offsets', () => {
      mockBuffer[HeaderLocation.Version] = 6;
      // Header stores offset/8; 0x400 means actual offset 0x2000
      mockBuffer.writeUInt16BE(0x400, HeaderLocation.RoutinesOffset);
      mockBuffer.writeUInt16BE(0x600, HeaderLocation.StaticStringsOffset);
      memory = new Memory(mockBuffer, { logger: mockLogger });

      // For V6/V7, byte = 4*packed + offset*8
      const byteAddr = 0x2004; // 4 bytes after routine offset 0x2000
      const packedAddr = 0x1; // (0x2004 - 0x2000) / 4

      expect(memory.byteToPackedAddress(byteAddr, true)).toBe(packedAddr);
      expect(memory.packedToByteAddress(packedAddr, true)).toBe(byteAddr);

      // Test string addresses (offset 0x600*8 = 0x3000)
      const stringByteAddr = 0x3004;
      const stringPackedAddr = 0x1;

      expect(memory.byteToPackedAddress(stringByteAddr, false)).toBe(stringPackedAddr);
      expect(memory.packedToByteAddress(stringPackedAddr, false)).toBe(stringByteAddr);
    });
  });

  describe('Block Operations', () => {
    let memory: Memory;

    beforeEach(() => {
      memory = new Memory(mockBuffer, { logger: mockLogger });
    });

    it('should get bytes correctly', () => {
      // Setup test data
      for (let i = 0; i < 10; i++) {
        memory.setByte(0x100 + i, i);
      }

      const bytes = memory.getBytes(0x100, 10);
      expect(bytes.length).toBe(10);
      for (let i = 0; i < 10; i++) {
        expect(bytes[i]).toBe(i);
      }
    });

    it('should get bytes from read-only memory', () => {
      // Read from static memory (read-only)
      const bytes = memory.getBytes(0x500, 5);
      expect(bytes.length).toBe(5);
    });

    it('should throw error when getting bytes out of bounds', () => {
      expect(() => memory.getBytes(0xffff, 10)).toThrow(/Memory access out of bounds/);
      expect(() => memory.getBytes(0x10000, 5)).toThrow(/Memory access out of bounds/);
    });

    it('should set bytes correctly', () => {
      const testData = Buffer.from([0xaa, 0xbb, 0xcc, 0xdd]);
      memory.setBytes(0x100, testData);

      expect(memory.getByte(0x100)).toBe(0xaa);
      expect(memory.getByte(0x101)).toBe(0xbb);
      expect(memory.getByte(0x102)).toBe(0xcc);
      expect(memory.getByte(0x103)).toBe(0xdd);
    });

    it('should warn when setting bytes to static memory', () => {
      const testData = Buffer.from([0xaa, 0xbb]);
      memory.setBytes(0x500, testData);
      expect(memory.getByte(0x500)).toBe(0xaa);
      expect(memory.getByte(0x501)).toBe(0xbb);
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('non-dynamic memory'));
    });

    it('should allow writes at 0x0400 with warning', () => {
      const testData = Buffer.from([0xaa]);
      memory.setBytes(0x0400, testData);
      expect(memory.getByte(0x0400)).toBe(0xaa);
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('non-dynamic memory'));
    });

    it('should throw error when setting bytes out of bounds', () => {
      const testData = Buffer.from([0xaa, 0xbb]);
      expect(() => memory.setBytes(0xffff, testData)).toThrow(/Memory access out of bounds/);
    });

    it('should handle zero-length copy block', () => {
      // Should not throw and should not modify memory
      memory.setByte(0x100, 0xaa);
      memory.copyBlock(0x100, 0x200, 0);
      expect(memory.getByte(0x100)).toBe(0xaa);
      expect(memory.getByte(0x200)).toBe(0);
    });

    it('should handle zero-length compare block', () => {
      expect(memory.compareBlock(0x100, 0x200, 0)).toBe(0);
    });
  });

  describe('Test Utilities', () => {
    let memory: Memory;

    beforeEach(() => {
      memory = new Memory(mockBuffer, { logger: mockLogger });
    });

    it('should set memory for testing with protection warning', () => {
      const testData = Buffer.from([0xaa, 0xbb, 0xcc]);
      // With protection, writes to static memory should warn but succeed
      memory.setMemoryForTesting(0x500, testData, false);
      expect(memory.getByte(0x500)).toBe(0xaa);
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('non-dynamic memory'));
    });

    it('should set memory for testing without protection', () => {
      const testData = Buffer.from([0xaa, 0xbb, 0xcc]);
      // Without protection, should succeed even in read-only memory
      memory.setMemoryForTesting(0x500, testData, true);
      expect(memory.getByte(0x500)).toBe(0xaa);
      expect(memory.getByte(0x501)).toBe(0xbb);
      expect(memory.getByte(0x502)).toBe(0xcc);
    });

    it('should throw error when setting memory out of bounds even with ignoreProtection', () => {
      const testData = Buffer.from([0xaa]);
      expect(() => memory.setMemoryForTesting(0x10000, testData, true)).toThrow(/Memory access out of bounds/);
    });
  });

  describe('Unicode Translation', () => {
    let memory: Memory;

    beforeEach(() => {
      mockBuffer[HeaderLocation.Version] = 5;

      // Setup header extension table
      mockBuffer.writeUInt16BE(0x0900, HeaderLocation.HeaderExtTable);
      mockBuffer.writeUInt16BE(0x0a00, 0x0906); // Unicode table address at header ext + 6

      // Setup Unicode translation table with 1 entry
      mockBuffer[0x0a00] = 1; // 1 entry
      mockBuffer.writeUInt16BE(0x1234, 0x0a01); // ZSCII 155 maps to Unicode 0x1234

      memory = new Memory(mockBuffer, { logger: mockLogger });
    });

    it('should convert ZSCII to Unicode correctly', () => {
      // ASCII range passes through directly
      expect(memory.zsciiToUnicode(65)).toBe(65); // 'A'

      // Newline special case
      expect(memory.zsciiToUnicode(13)).toBe(10);

      // Custom mapping from table
      expect(memory.zsciiToUnicode(155)).toBe(0x1234);

      // Unmapped characters should return '?'
      expect(memory.zsciiToUnicode(156)).toBe(63);
    });
  });

  describe('Memory Utilities', () => {
    let memory: Memory;

    beforeEach(() => {
      memory = new Memory(mockBuffer, { logger: mockLogger });
    });

    it('should dump memory correctly', () => {
      // Setup some known memory
      for (let i = 0; i < 32; i++) {
        memory.setMemoryForTesting(0x100 + i, Buffer.from([i]), true);
      }

      const dump = memory.dumpMemory(0x100, 32);

      // Check it's a properly formatted string
      expect(typeof dump).toBe('string');
      expect(dump.length).toBeGreaterThan(0);
      expect(dump).toContain('0100:'); // Should contain the starting address
    });

    it('should get alphabet tables', () => {
      // Mock getAlphabetTables for this test
      vi.spyOn(AlphabetTableManager.prototype, 'getAlphabetTables').mockImplementation(() => [
        'abcdefghijklmnopqrstuvwxyz',
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        ' \n0123456789.,!?_#\'"/\\-:()',
      ]);

      const tables = memory.getAlphabetTables();

      expect(tables).toHaveLength(3);
      expect(tables[0]).toBe('abcdefghijklmnopqrstuvwxyz');
      expect(tables[1]).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
      expect(tables[2]).toBe(' \n0123456789.,!?_#\'"/\\-:()');

      vi.restoreAllMocks();
    });
  });

  describe('Routine Header Validation', () => {
    let memory: Memory;

    beforeEach(() => {
      mockBuffer[HeaderLocation.Version] = 3;
      memory = new Memory(mockBuffer, { logger: mockLogger });
    });

    it('should validate V4 routine headers with locals', () => {
      mockBuffer[HeaderLocation.Version] = 4;
      memory = new Memory(mockBuffer, { logger: mockLogger });

      // Valid routine with 2 locals
      memory.setMemoryForTesting(0x1000, Buffer.from([0x02, 0x00, 0x00, 0x00, 0x00]), true);
      expect(memory.validateRoutineHeader(0x1000)).toBe(true);

      // Valid routine with 0 locals
      memory.setMemoryForTesting(0x1100, Buffer.from([0x00, 0x00, 0x00]), true);
      expect(memory.validateRoutineHeader(0x1100)).toBe(true);

      // Valid routine with 15 locals (max)
      const maxLocalsData = Buffer.alloc(1 + 15 * 2);
      maxLocalsData[0] = 15;
      memory.setMemoryForTesting(0x1200, maxLocalsData, true);
      expect(memory.validateRoutineHeader(0x1200)).toBe(true);
    });

    it('should validate V5+ routine headers', () => {
      mockBuffer[HeaderLocation.Version] = 5;
      memory = new Memory(mockBuffer, { logger: mockLogger });

      // V5+ only needs the header byte
      memory.setMemoryForTesting(0x1000, Buffer.from([0x05]), true);
      expect(memory.validateRoutineHeader(0x1000)).toBe(true);
    });

    it('should reject routine headers in dynamic memory', () => {
      memory.setMemoryForTesting(0x100, Buffer.from([0x02, 0x00, 0x00]), true);
      expect(memory.validateRoutineHeader(0x100)).toBe(false);
    });

    it('should reject unaligned routine headers', () => {
      // V3 requires 2-byte alignment
      memory.setMemoryForTesting(0x1001, Buffer.from([0x02, 0x00, 0x00]), true);
      expect(memory.validateRoutineHeader(0x1001)).toBe(false);
    });

    it('should reject routine headers with invalid locals count', () => {
      // Too many locals (>15)
      memory.setMemoryForTesting(0x1000, Buffer.from([0x20]), true);
      expect(memory.validateRoutineHeader(0x1000)).toBe(false);
    });

    it('should reject routine headers that are out of bounds', () => {
      expect(memory.validateRoutineHeader(0x10000)).toBe(false);
    });

    it('should handle errors during validation gracefully', () => {
      // Set up a routine header that will cause an error when reading locals
      memory.setMemoryForTesting(0x1000, Buffer.from([0x10]), true);
      // Make the memory access fail by setting up invalid state
      // This tests the catch block in validateRoutineHeader
      const result = memory.validateRoutineHeader(0x1000);
      // Should return false or handle gracefully
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Header Validation', () => {
    it('should throw error for file size too large', () => {
      // Create buffer larger than max for V3 (256KB max)
      const largeBuffer = Buffer.alloc(257 * 1024);
      largeBuffer[HeaderLocation.Version] = 3;
      largeBuffer.writeUInt16BE(0x0400, HeaderLocation.StaticMemBase);
      largeBuffer.writeUInt16BE(0x0800, HeaderLocation.HighMemBase);

      expect(() => new Memory(largeBuffer, { logger: mockLogger })).toThrow(/exceeds maximum size/);
    });

    it('should throw error for file size too small', () => {
      // Create buffer smaller than minimum header (64 bytes for V3)
      const smallBuffer = Buffer.alloc(32);
      smallBuffer[HeaderLocation.Version] = 3;

      expect(() => new Memory(smallBuffer, { logger: mockLogger })).toThrow(/Memory too small for header/);
    });

    it('should validate dynamic memory size within limits', () => {
      mockBuffer[HeaderLocation.Version] = 3;
      // Test with maximum valid value (0xffff)
      mockBuffer.writeUInt16BE(0xffff, HeaderLocation.StaticMemBase);
      mockBuffer.writeUInt16BE(0xffff, HeaderLocation.HighMemBase);
      // This should pass validation since 0xffff <= 0xffff
      expect(() => new Memory(mockBuffer, { logger: mockLogger })).not.toThrow();

      // Test with a value that's clearly within limits
      mockBuffer.writeUInt16BE(0x8000, HeaderLocation.StaticMemBase);
      mockBuffer.writeUInt16BE(0x9000, HeaderLocation.HighMemBase);
      expect(() => new Memory(mockBuffer, { logger: mockLogger })).not.toThrow();
    });

    it('should validate V4 alphabet table if present', () => {
      mockBuffer[HeaderLocation.Version] = 4;
      mockBuffer.writeUInt16BE(0x1000, HeaderLocation.AlphabetTable);

      // Set up valid alphabet table (26 * 3 = 78 bytes) in the buffer directly
      const alphabetData = Buffer.alloc(78, 0x41); // Fill with 'A'
      alphabetData.copy(mockBuffer, 0x1000);

      expect(() => new Memory(mockBuffer, { logger: mockLogger })).not.toThrow();
    });

    it('should throw error for invalid V4 alphabet table', () => {
      mockBuffer[HeaderLocation.Version] = 4;
      mockBuffer.writeUInt16BE(0xffff, HeaderLocation.AlphabetTable); // Out of bounds

      expect(() => new Memory(mockBuffer, { logger: mockLogger })).toThrow(/alphabet table.*is invalid/);
    });

    it('should validate V5+ routine and string offsets', () => {
      mockBuffer[HeaderLocation.Version] = 5;
      mockBuffer.writeUInt16BE(0x0000, HeaderLocation.RoutinesOffset);
      mockBuffer.writeUInt16BE(0x0000, HeaderLocation.StaticStringsOffset);

      // V5 doesn't require non-zero offsets, so this should pass
      expect(() => new Memory(mockBuffer, { logger: mockLogger })).not.toThrow();
    });

    it('should validate V6/V7 require non-zero offsets', () => {
      mockBuffer[HeaderLocation.Version] = 6;
      mockBuffer.writeUInt16BE(0x0000, HeaderLocation.RoutinesOffset);
      mockBuffer.writeUInt16BE(0x0000, HeaderLocation.StaticStringsOffset);

      expect(() => new Memory(mockBuffer, { logger: mockLogger })).toThrow(/requires non-zero routine and string offsets/);
    });

    it('should validate V6/V7 fields correctly', () => {
      mockBuffer[HeaderLocation.Version] = 6;
      mockBuffer.writeUInt16BE(0x2000, HeaderLocation.RoutinesOffset);
      mockBuffer.writeUInt16BE(0x3000, HeaderLocation.StaticStringsOffset);

      expect(() => new Memory(mockBuffer, { logger: mockLogger })).not.toThrow();
    });
  });

  describe('Header Extension Validation', () => {
    it('should validate header extension table for V5+', () => {
      mockBuffer[HeaderLocation.Version] = 5;
      mockBuffer.writeUInt16BE(0x0900, HeaderLocation.HeaderExtTable);

      // Set up valid header extension table
      mockBuffer[0x0900] = 5; // Table size
      for (let i = 0; i < 5; i++) {
        mockBuffer.writeUInt16BE(0x0a00 + i * 2, 0x0900 + 1 + i * 2);
      }

      expect(() => new Memory(mockBuffer, { logger: mockLogger })).not.toThrow();
    });

    it('should validate header extension address bounds', () => {
      mockBuffer[HeaderLocation.Version] = 5;
      // Test with a valid address within bounds
      mockBuffer.writeUInt16BE(0x0900, HeaderLocation.HeaderExtTable);
      expect(() => new Memory(mockBuffer, { logger: mockLogger })).not.toThrow();

      // Test with an address that's out of bounds for a smaller buffer
      const smallBuffer = Buffer.alloc(0x1000);
      smallBuffer[HeaderLocation.Version] = 5;
      smallBuffer.writeUInt16BE(0x0fff, HeaderLocation.HeaderExtTable);
      smallBuffer.writeUInt16BE(0x0400, HeaderLocation.StaticMemBase);
      smallBuffer.writeUInt16BE(0x0800, HeaderLocation.HighMemBase);
      // 0x0fff is within 0x1000, so it should pass
      expect(() => new Memory(smallBuffer, { logger: mockLogger })).not.toThrow();
    });

    it('should validate header extension table entries', () => {
      const smallBuffer = Buffer.alloc(0x2000);
      smallBuffer[HeaderLocation.Version] = 5;
      smallBuffer.writeUInt16BE(0x0900, HeaderLocation.HeaderExtTable);
      smallBuffer.writeUInt16BE(0x0400, HeaderLocation.StaticMemBase);
      smallBuffer.writeUInt16BE(0x0800, HeaderLocation.HighMemBase);

      // Test with valid header extension table size
      smallBuffer[0x0900] = 10; // Valid size
      expect(() => new Memory(smallBuffer, { logger: mockLogger })).not.toThrow();
    });
  });

  describe('Version-Specific Behavior', () => {
    it('should initialize V1 correctly', () => {
      mockBuffer[HeaderLocation.Version] = 1;
      mockBuffer.writeUInt16BE(0x0400, HeaderLocation.StaticMemBase);
      mockBuffer.writeUInt16BE(0x0800, HeaderLocation.HighMemBase);

      const memory = new Memory(mockBuffer, { logger: mockLogger });
      expect(memory.version).toBe(1);
      expect(memory.getAlphabetTables()).toHaveLength(3);
    });

    it('should initialize V2 correctly', () => {
      mockBuffer[HeaderLocation.Version] = 2;
      mockBuffer.writeUInt16BE(0x0400, HeaderLocation.StaticMemBase);
      mockBuffer.writeUInt16BE(0x0800, HeaderLocation.HighMemBase);

      const memory = new Memory(mockBuffer, { logger: mockLogger });
      expect(memory.version).toBe(2);
    });

    it('should initialize V4 correctly', () => {
      mockBuffer[HeaderLocation.Version] = 4;
      mockBuffer.writeUInt16BE(0x0400, HeaderLocation.StaticMemBase);
      mockBuffer.writeUInt16BE(0x0800, HeaderLocation.HighMemBase);
      mockBuffer.writeUInt16BE(0x0000, HeaderLocation.AlphabetTable); // No custom alphabet

      const memory = new Memory(mockBuffer, { logger: mockLogger });
      expect(memory.version).toBe(4);
    });

    it('should initialize V6 correctly with offsets', () => {
      mockBuffer[HeaderLocation.Version] = 6;
      mockBuffer.writeUInt16BE(0x2000, HeaderLocation.RoutinesOffset);
      mockBuffer.writeUInt16BE(0x3000, HeaderLocation.StaticStringsOffset);

      const memory = new Memory(mockBuffer, { logger: mockLogger });
      expect(memory.version).toBe(6);
    });

    it('should initialize V7 correctly with offsets', () => {
      mockBuffer[HeaderLocation.Version] = 7;
      mockBuffer.writeUInt16BE(0x2000, HeaderLocation.RoutinesOffset);
      mockBuffer.writeUInt16BE(0x3000, HeaderLocation.StaticStringsOffset);

      const memory = new Memory(mockBuffer, { logger: mockLogger });
      expect(memory.version).toBe(7);
    });

    it('should initialize V8 correctly', () => {
      // V8 requires 128-byte header
      const v8Buffer = Buffer.alloc(0x20000);
      v8Buffer[HeaderLocation.Version] = 8;
      v8Buffer.writeUInt16BE(0x0400, HeaderLocation.StaticMemBase);
      v8Buffer.writeUInt16BE(0x0800, HeaderLocation.HighMemBase);

      const memory = new Memory(v8Buffer, { logger: mockLogger });
      expect(memory.version).toBe(8);
    });

    it('should handle V6/V7 packed addresses with offsets', () => {
      mockBuffer[HeaderLocation.Version] = 6;
      // Header stores offset/8: 0x400 -> 0x2000, 0x600 -> 0x3000
      mockBuffer.writeUInt16BE(0x400, HeaderLocation.RoutinesOffset);
      mockBuffer.writeUInt16BE(0x600, HeaderLocation.StaticStringsOffset);
      const memory = new Memory(mockBuffer, { logger: mockLogger });

      // Test routine address conversion: byte = 4*packed + 0x2000
      const byteAddr = 0x2004;
      const packedAddr = memory.byteToPackedAddress(byteAddr, true);
      expect(memory.packedToByteAddress(packedAddr, true)).toBe(byteAddr);

      // Test string address conversion: byte = 4*packed + 0x3000
      const stringByteAddr = 0x3004;
      const stringPackedAddr = memory.byteToPackedAddress(stringByteAddr, false);
      expect(memory.packedToByteAddress(stringPackedAddr, false)).toBe(stringByteAddr);
    });
  });

  describe('Unicode Translation Edge Cases', () => {
    it('should handle missing header extension table', () => {
      mockBuffer[HeaderLocation.Version] = 5;
      mockBuffer.writeUInt16BE(0x0000, HeaderLocation.HeaderExtTable);

      const memory = new Memory(mockBuffer, { logger: mockLogger });
      // Should not throw, but Unicode table should be null
      expect(memory.zsciiToUnicode(155)).toBe(63); // Should return '?'
    });

    it('should handle invalid Unicode table address', () => {
      mockBuffer[HeaderLocation.Version] = 5;
      mockBuffer.writeUInt16BE(0x0900, HeaderLocation.HeaderExtTable);
      mockBuffer.writeUInt16BE(0x0000, 0x0906); // Unicode table address = 0

      const memory = new Memory(mockBuffer, { logger: mockLogger });
      expect(memory.zsciiToUnicode(155)).toBe(63);
    });

    it('should handle empty Unicode table', () => {
      mockBuffer[HeaderLocation.Version] = 5;
      mockBuffer.writeUInt16BE(0x0900, HeaderLocation.HeaderExtTable);
      mockBuffer.writeUInt16BE(0x0a00, 0x0906);
      mockBuffer[0x0a00] = 0; // 0 entries

      const memory = new Memory(mockBuffer, { logger: mockLogger });
      expect(memory.zsciiToUnicode(155)).toBe(63);
    });

    it('should handle Unicode table loading errors gracefully', () => {
      mockBuffer[HeaderLocation.Version] = 5;
      mockBuffer.writeUInt16BE(0x0900, HeaderLocation.HeaderExtTable);
      mockBuffer.writeUInt16BE(0xffff, 0x0906); // Invalid address

      const memory = new Memory(mockBuffer, { logger: mockLogger });
      // Should handle error and return '?' for unmapped characters
      expect(memory.zsciiToUnicode(155)).toBe(63);
    });

    it('should handle Unicode table that is too short', () => {
      mockBuffer[HeaderLocation.Version] = 5;
      mockBuffer.writeUInt16BE(0x0900, HeaderLocation.HeaderExtTable);
      mockBuffer.writeUInt16BE(0x0a00, 0x0906);
      // Set header extension table address to point to invalid location
      mockBuffer.writeUInt16BE(0xffff, HeaderLocation.HeaderExtTable);

      const memory = new Memory(mockBuffer, { logger: mockLogger });
      expect(memory.zsciiToUnicode(155)).toBe(63);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    let memory: Memory;

    beforeEach(() => {
      memory = new Memory(mockBuffer, { logger: mockLogger });
    });

    it('should handle Z-string with immediate termination', () => {
      // Z-string that terminates in first word
      memory.setMemoryForTesting(0x800, Buffer.from([0x80, 0x00]), true);
      const zstr = memory.getZString(0x800);
      expect(zstr).toBeInstanceOf(Array);
    });

    it('should handle Z-string reaching file size limit', () => {
      // Create a buffer at max file size for V3
      const maxSize = 256 * 1024;
      const largeBuffer = Buffer.alloc(maxSize);
      largeBuffer[HeaderLocation.Version] = 3;
      largeBuffer.writeUInt16BE(0x0400, HeaderLocation.StaticMemBase);
      largeBuffer.writeUInt16BE(0x0800, HeaderLocation.HighMemBase);

      const largeMemory = new Memory(largeBuffer, { logger: mockLogger });
      // Place string near the end
      const nearEnd = maxSize - 10;
      largeMemory.setMemoryForTesting(nearEnd, Buffer.from([0x00, 0x00]), true);

      const zstr = largeMemory.getZString(nearEnd);
      expect(zstr).toBeInstanceOf(Array);
    });

    it('should handle memory dump edge case', () => {
      // Test the special case at 1000/100
      expect(() => memory.dumpMemory(1000, 100)).toThrow(/Memory dump range out of bounds/);
    });

    it('should handle negative addresses in getByte', () => {
      expect(() => memory.getByte(-1)).toThrow(/Memory access out of bounds/);
    });

    it('should handle negative addresses in setByte', () => {
      expect(() => memory.setByte(-1, 0xaa)).toThrow(/Memory access out of bounds/);
    });

    it('should handle negative addresses in getWord', () => {
      expect(() => memory.getWord(-1)).toThrow(/Memory access out of bounds/);
    });

    it('should handle negative addresses in setWord', () => {
      expect(() => memory.setWord(-1, 0xaabb)).toThrow(/Memory access out of bounds/);
    });

    it('should handle boundary conditions at memory limits', () => {
      // Test at exact boundary
      const lastAddr = memory.size - 1;
      expect(() => memory.getByte(lastAddr)).not.toThrow();
      expect(() => memory.getByte(lastAddr + 1)).toThrow(/Memory access out of bounds/);

      // Test word at boundary
      const wordAddr = memory.size - 2;
      expect(() => memory.getWord(wordAddr)).not.toThrow();
      expect(() => memory.getWord(wordAddr + 1)).toThrow(/Memory access out of bounds/);
    });

    it('should handle copyBlock with overlapping regions edge cases', () => {
      // Setup source data
      for (let i = 0; i < 10; i++) {
        memory.setByte(0x100 + i, i);
      }

      // Test exact overlap (source == dest)
      memory.copyBlock(0x100, 0x100, 10);
      expect(memory.getByte(0x100)).toBe(0);

      // Test single-byte overlap
      memory.setByte(0x200, 0xaa);
      memory.setByte(0x201, 0xbb);
      memory.copyBlock(0x200, 0x201, 2);
      expect(memory.getByte(0x201)).toBe(0xaa);
      expect(memory.getByte(0x202)).toBe(0xbb);
    });

    it('should handle compareBlock with different first bytes', () => {
      memory.setByte(0x100, 0x10);
      memory.setByte(0x200, 0x20);

      const result = memory.compareBlock(0x100, 0x200, 1);
      expect(result).toBeLessThan(0); // 0x10 < 0x20
    });

    it('should handle compareBlock with different later bytes', () => {
      memory.setByte(0x100, 0x10);
      memory.setByte(0x101, 0x20);
      memory.setByte(0x200, 0x10);
      memory.setByte(0x201, 0x30);

      const result = memory.compareBlock(0x100, 0x200, 2);
      expect(result).toBeLessThan(0); // 0x20 < 0x30
    });

    it('should handle getZString with various termination scenarios', () => {
      // Immediate termination (first bit set)
      memory.setMemoryForTesting(0x800, Buffer.from([0x80, 0x00]), true);
      const zstr1 = memory.getZString(0x800);
      expect(zstr1).toBeInstanceOf(Array);

      // Termination after one word
      memory.setMemoryForTesting(0x900, Buffer.from([0x00, 0x00, 0x80, 0x00]), true);
      const zstr2 = memory.getZString(0x900);
      expect(zstr2).toBeInstanceOf(Array);

      // No termination (will hit safety limit)
      const noTermData = Buffer.alloc(100, 0);
      memory.setMemoryForTesting(0xa00, noTermData, true);
      const zstr3 = memory.getZString(0xa00);
      expect(zstr3).toBeInstanceOf(Array);
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should handle dumpMemory with various sizes', () => {
      // Test with size less than 16 bytes
      const dump1 = memory.dumpMemory(0x100, 8);
      expect(dump1).toContain('0100:');

      // Test with size exactly 16 bytes
      const dump2 = memory.dumpMemory(0x100, 16);
      expect(dump2).toContain('0100:');

      // Test with size greater than 16 bytes
      const dump3 = memory.dumpMemory(0x100, 32);
      expect(dump3).toContain('0100:');
      expect(dump3).toContain('0110:');
    });

    it('should handle getAlphabetTables when AlphabetTableManager is null', () => {
      // For version 0 (invalid but skipValidation), alphabet manager should be null
      mockBuffer[HeaderLocation.Version] = 0;
      const mem = new Memory(mockBuffer, { logger: mockLogger, skipValidation: true });
      const tables = mem.getAlphabetTables();
      // Should return default fallback
      expect(tables).toHaveLength(3);
      expect(tables[0]).toBe('abcdefghijklmnopqrstuvwxyz');
    });
  });

  describe('Static Methods', () => {
    it('should handle fromFile static method', () => {
      // Mock fs.readFileSync to return a buffer with a complete valid header (64 bytes)
      vi.mock('fs', () => ({
        readFileSync: vi.fn(() => {
          // Create a buffer of 64 bytes (minimum header size for v3)
          const buffer = Buffer.alloc(64, 0);

          // Set the basic header values needed for validation
          buffer[0] = 3; // Version 3
          buffer.writeUInt16BE(0x0400, HeaderLocation.StaticMemBase); // 0x0e = 0x400
          buffer.writeUInt16BE(0x0800, HeaderLocation.HighMemBase); // 0x04 = 0x800

          return buffer;
        }),
      }));

      const memory = Memory.fromFile('dummy.z3', { logger: mockLogger });

      expect(memory).toBeInstanceOf(Memory);
      expect(memory.version).toBe(3);

      vi.restoreAllMocks();
    });

    it('should handle fromFile with file read errors', () => {
      // Mock fs.readFileSync to throw an error
      const mockReadFileSync = vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      // Test that fromFile properly wraps file system errors
      expect(() => Memory.fromFile('nonexistent.z3', { logger: mockLogger })).toThrow(
        /Failed to load story file/
      );

      expect(mockReadFileSync).toHaveBeenCalledWith('nonexistent.z3');

      // Restore
      mockReadFileSync.mockRestore();
    });
  });
});
