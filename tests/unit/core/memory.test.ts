import { beforeEach, describe, expect, it, vi } from 'vitest';
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
    vi.spyOn(mockLogger, 'error');
    vi.spyOn(mockLogger, 'warn');
    vi.spyOn(mockLogger, 'debug');

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

    it('should throw an error when high memory overlaps dynamic memory', () => {
      mockBuffer[HeaderLocation.Version] = 3;
      mockBuffer.writeUInt16BE(0x0400, HeaderLocation.StaticMemBase);
      mockBuffer.writeUInt16BE(0x0300, HeaderLocation.HighMemBase);

      expect(() => new Memory(mockBuffer, { logger: mockLogger })).toThrow(
        'High memory start (768) overlaps with dynamic memory end (1024)'
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

      // Test writing to read-only memory
      expect(() => memory.setByte(0x400, 0xcc)).toThrow(/Cannot write to read-only memory/);

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

      // Test writing to read-only memory
      expect(() => memory.setWord(0x400, 0xeeff)).toThrow(/Cannot write to read-only memory/);

      // Test straddling memory regions
      expect(() => memory.setWord(0x3ff, 0x1122)).toThrow(/Cannot write to read-only memory/);

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

      // Test copy to read-only memory
      expect(() => memory.copyBlock(0x100, 0x400, 10)).toThrow(/Cannot write to read-only memory/);
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

  describe('Z-String Operations', () => {
    let memory: Memory;

    beforeEach(() => {
      memory = new Memory(mockBuffer, { logger: mockLogger });

      // Setup a sample Z-string in high memory
      // This is a simplified Z-string: "Hello" with end bit set
      memory.setMemoryForTesting(0x800, Buffer.from([0x48, 0xe5, 0x9c, 0xa5, 0x90, 0xa4, 0x11, 0x42]), true);
    });

    it('should read Z-strings correctly', () => {
      const zstr = memory.getZString(0x800);

      // This test depends on the actual Z-string encoding implementation
      // We're just checking that something was read and the function did not throw
      expect(zstr).toBeInstanceOf(Array);
      expect(zstr.length).toBeGreaterThan(0);
    });

    it('should handle malformed Z-strings safely', () => {
      // Create a Z-string that never terminates (no high bit set)
      memory.setMemoryForTesting(0x900, Buffer.from([0x00, 0x00, 0x00, 0x00]), true);

      const zstr = memory.getZString(0x900);

      // Should not hang and should return something
      expect(zstr).toBeInstanceOf(Array);
    });

    it('should throw error for invalid Z-string addresses', () => {
      expect(() => memory.getZString(0x10000)).toThrow(/String address out of bounds/);
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
  });
});
