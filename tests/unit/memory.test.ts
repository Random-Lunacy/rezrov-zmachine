import { beforeEach, describe, expect, it } from 'vitest';
import { Memory } from '../../src/core/memory/Memory';
import { HeaderLocation } from '../../src/utils/constants';

describe('Memory', () => {
  let buffer: Buffer;
  let memory: Memory;

  beforeEach(() => {
    // Create a mock story file buffer with a basic header
    buffer = Buffer.alloc(1024);

    // Set version to 3
    buffer[HeaderLocation.Version] = 3;

    // Set static memory base to 0x0400 (1024)
    buffer[HeaderLocation.StaticMemBase] = 0x04;
    buffer[HeaderLocation.StaticMemBase + 1] = 0x00;

    // Set high memory base to 0x0200 (512)
    buffer[HeaderLocation.HighMemBase] = 0x02;
    buffer[HeaderLocation.HighMemBase + 1] = 0x00;

    memory = new Memory(buffer);
  });

  describe('memory regions', () => {
    it('correctly identifies dynamic memory', () => {
      expect(memory.isDynamicMemory(0)).toBe(true);
      expect(memory.isDynamicMemory(10)).toBe(true);
      expect(memory.isDynamicMemory(1023)).toBe(false);
      expect(memory.isDynamicMemory(0x03ff)).toBe(true);
      expect(memory.isDynamicMemory(0x0400)).toBe(false);
    });

    it('correctly identifies static memory', () => {
      expect(memory.isStaticMemory(0)).toBe(false);
      expect(memory.isStaticMemory(0x03ff)).toBe(false);
      expect(memory.isStaticMemory(0x0400)).toBe(true);
      expect(memory.isStaticMemory(0x01ff)).toBe(false);
      expect(memory.isStaticMemory(0x0200)).toBe(false);
    });

    it('correctly identifies high memory', () => {
      expect(memory.isHighMemory(0)).toBe(false);
      expect(memory.isHighMemory(0x01ff)).toBe(false);
      expect(memory.isHighMemory(0x0200)).toBe(true);
      expect(memory.isHighMemory(0x03ff)).toBe(false);
      expect(memory.isHighMemory(0x0400)).toBe(false);
    });
  });

  describe('memory access', () => {
    it('allows byte reads from all memory regions', () => {
      // Dynamic memory
      expect(() => memory.getByte(0)).not.toThrow();

      // Static memory
      expect(() => memory.getByte(0x0400)).not.toThrow();

      // High memory
      expect(() => memory.getByte(0x0200)).not.toThrow();
    });

    it('allows byte writes only to dynamic memory', () => {
      // Dynamic memory - should work
      expect(() => memory.setByte(0, 42)).not.toThrow();

      // Static memory - should throw
      expect(() => memory.setByte(0x0400, 42)).toThrow(/Cannot write to read-only memory/);

      // High memory - should throw
      expect(() => memory.setByte(0x0200, 42)).toThrow(/Cannot write to read-only memory/);
    });

    it('allows word reads from all memory regions', () => {
      // Dynamic memory
      expect(() => memory.getWord(0)).not.toThrow();

      // Static memory
      expect(() => memory.getWord(0x0400)).not.toThrow();

      // High memory
      expect(() => memory.getWord(0x0200)).not.toThrow();
    });

    it('allows word writes only to dynamic memory', () => {
      // Dynamic memory - should work
      expect(() => memory.setWord(0, 0x1234)).not.toThrow();

      // Static memory - should throw
      expect(() => memory.setWord(0x0400, 0x1234)).toThrow(/Cannot write to read-only memory/);

      // High memory - should throw
      expect(() => memory.setWord(0x0200, 0x1234)).toThrow(/Cannot write to read-only memory/);
    });

    it('prevents reads beyond buffer length', () => {
      expect(() => memory.getByte(1024)).toThrow(/Memory access out of bounds/);
      expect(() => memory.getWord(1023)).toThrow(/Memory access out of bounds/);
    });

    it('prevents writes beyond buffer length', () => {
      expect(() => memory.setByte(1024, 0)).toThrow(/Memory access out of bounds/);
      expect(() => memory.setWord(1023, 0)).toThrow(/Memory access out of bounds/);
    });

    it('correctly reads and writes bytes', () => {
      memory.setByte(10, 42);
      expect(memory.getByte(10)).toBe(42);

      memory.setByte(11, 0xff);
      expect(memory.getByte(11)).toBe(0xff);

      memory.setByte(12, 0x100); // Should truncate to 0x00
      expect(memory.getByte(12)).toBe(0);
    });

    it('correctly reads and writes words', () => {
      memory.setWord(20, 0x1234);
      expect(memory.getWord(20)).toBe(0x1234);

      memory.setWord(22, 0xffff);
      expect(memory.getWord(22)).toBe(0xffff);

      memory.setWord(24, 0x10000); // Should truncate to 0x0000
      expect(memory.getWord(24)).toBe(0);

      // Verify byte ordering (high byte first, low byte second)
      memory.setWord(26, 0xabcd);
      expect(memory.getByte(26)).toBe(0xab);
      expect(memory.getByte(27)).toBe(0xcd);
    });
  });

  describe('z-strings', () => {
    it('correctly reads z-strings with terminator', () => {
      // Set up a simple Z-string with terminator (high bit set)
      memory.setWord(100, 0x8123); // Single word with high bit set

      const zstring = memory.getZString(100);

      // Check that we got 3 Z-characters (5 bits each)
      expect(zstring).toHaveLength(3);

      // Verify Z-characters (bits 10-6, 5-1, and 0 of word + 4 high bits)
      expect(zstring[0]).toBe(0x04); // 00100 (bits 10-6)
      expect(zstring[1]).toBe(0x09); // 01001 (bits 5-1)
      expect(zstring[2]).toBe(0x03); // 00011 (bit 0 + 4 high bits)
    });

    it('correctly reads multi-word z-strings', () => {
      // Set up a Z-string that spans two words
      memory.setWord(100, 0x1234); // First word without terminator
      memory.setWord(102, 0x8567); // Second word with terminator

      const zstring = memory.getZString(100);

      // Check that we got 6 Z-characters (3 from each word)
      expect(zstring).toHaveLength(6);

      // First word Z-characters
      expect(zstring[0]).toBe(0x04); // 00100 (bits 10-6 of 0x1234)
      expect(zstring[1]).toBe(0x08); // 01000 (bits 5-1 of 0x1234)
      expect(zstring[2]).toBe(0x14); // 10100 (bit 0 of 0x1234 + 4 high bits)

      // Second word Z-characters
      expect(zstring[3]).toBe(0x02); // 00010 (bits 10-6 of 0x8567)
      expect(zstring[4]).toBe(0x0b); // 01011 (bits 5-1 of 0x8567)
      expect(zstring[5]).toBe(0x07); // 00111 (bit 0 of 0x8567 + 4 high bits)
    });

    it('has safeguards against infinite Z-strings', () => {
      // Create a buffer where all words don't have high bit set
      // This would normally cause an infinite loop without safeguards
      for (let i = 0; i < 2000; i += 2) {
        if (i < buffer.length - 1) {
          memory.setWord(i, 0x1234); // No termination bit
        }
      }

      // This should not hang
      const zstring = memory.getZString(100);

      // Should have stopped at some point
      expect(zstring.length).toBeLessThan(3000);
    });
  });

  describe('memory operations', () => {
    it('correctly copies memory blocks', () => {
      // Set up source data
      for (let i = 0; i < 10; i++) {
        memory.setByte(50 + i, i + 1);
      }

      // Copy to another location
      memory.copyBlock(50, 100, 10);

      // Verify the copy
      for (let i = 0; i < 10; i++) {
        expect(memory.getByte(100 + i)).toBe(i + 1);
      }
    });

    it('prevents copying to read-only memory', () => {
      // Try to copy to static memory
      expect(() => memory.copyBlock(50, 0x0400, 10)).toThrow(/Cannot write to read-only memory/);

      // Try to copy to high memory
      expect(() => memory.copyBlock(50, 0x0200, 10)).toThrow(/Cannot write to read-only memory/);
    });

    it('correctly compares memory blocks', () => {
      // Set up identical blocks
      for (let i = 0; i < 10; i++) {
        memory.setByte(50 + i, i + 1);
        memory.setByte(100 + i, i + 1);
      }

      // Set up different blocks
      for (let i = 0; i < 10; i++) {
        memory.setByte(150 + i, 10 - i);
      }

      // Compare identical blocks
      expect(memory.compareBlock(50, 100, 10)).toBe(0);

      // Compare different blocks
      expect(memory.compareBlock(50, 150, 10)).toBeLessThan(0);
      expect(memory.compareBlock(150, 50, 10)).toBeGreaterThan(0);
    });

    it('handles overlapping memory copies correctly', () => {
      // Set up source data
      for (let i = 0; i < 10; i++) {
        memory.setByte(50 + i, i + 1);
      }

      // Copy with overlap (destination is within source)
      memory.copyBlock(50, 55, 10);

      // First 5 bytes should still be original
      for (let i = 0; i < 5; i++) {
        expect(memory.getByte(50 + i)).toBe(i + 1);
      }

      // Next 5 bytes should now have values 1-5 (not 6-10)
      for (let i = 0; i < 5; i++) {
        expect(memory.getByte(55 + i)).toBe(i + 1);
      }
    });
  });

  describe('buffer operations', () => {
    it('gets bytes as buffer', () => {
      // Set up source data
      for (let i = 0; i < 10; i++) {
        memory.setByte(50 + i, i + 1);
      }

      const buf = memory.getBytes(50, 10);

      expect(buf).toBeInstanceOf(Buffer);
      expect(buf.length).toBe(10);

      for (let i = 0; i < 10; i++) {
        expect(buf[i]).toBe(i + 1);
      }
    });

    it('sets bytes from buffer', () => {
      const sourceData = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

      memory.setBytes(50, sourceData);

      for (let i = 0; i < 10; i++) {
        expect(memory.getByte(50 + i)).toBe(i + 1);
      }
    });

    it('prevents setting bytes to read-only memory', () => {
      const sourceData = Buffer.from([1, 2, 3, 4, 5]);

      expect(() => memory.setBytes(0x0400, sourceData)).toThrow(/Cannot write to read-only memory/);
    });
  });

  describe('getters', () => {
    it('returns correct memory size', () => {
      expect(memory.size).toBe(1024);
    });

    it('returns correct version', () => {
      expect(memory.version).toBe(3);
    });

    it('returns correct dynamicMemoryEnd', () => {
      expect(memory.dynamicMemoryEnd).toBe(0x0400);
    });

    it('returns correct highMemoryStart', () => {
      expect(memory.highMemoryStart).toBe(0x0200);
    });
  });

  describe('memory dump', () => {
    it('generates formatted memory dump', () => {
      // Set up some recognizable data
      memory.setByte(100, 65); // 'A'
      memory.setByte(101, 66); // 'B'
      memory.setByte(102, 67); // 'C'

      const dump = memory.dumpMemory(100, 16);

      // Check for basic structure
      expect(dump).toContain('0064:'); // Address
      expect(dump).toContain('41 42 43'); // Hex values for A, B, C
      expect(dump).toContain('ABC'); // ASCII representation
    });

    it('handles memory dump out of bounds', () => {
      expect(() => memory.dumpMemory(1000, 100)).toThrow(/Memory dump range out of bounds/);
    });
  });
});
