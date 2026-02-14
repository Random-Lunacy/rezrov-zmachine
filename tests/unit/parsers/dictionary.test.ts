import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Memory } from '../../../src/core/memory/Memory';
import { Dictionary } from '../../../src/parsers/Dictionary';
import { Address } from '../../../src/types';
import { Logger, LogLevel } from '../../../src/utils/log';
import { MockMemory } from '../../mocks/MockMemory';

// Suppress console output during tests
Logger.setLogToConsole(false);
Logger.setLevel(LogLevel.ERROR);

describe('Dictionary', () => {
  // Mock memory for testing
  let mockMemory: MockMemory;
  let logger: Logger;
  let dictionaryAddr: Address;

  // Set up before each test
  beforeEach(() => {
    // Create mock memory object
    mockMemory = new MockMemory();
    logger = new Logger('TestLogger');
    dictionaryAddr = 0x0500;

    // Mock version 3 by default
    mockMemory.version = 3;

    // Mock dictionary header structure
    // Byte 0: Number of separator characters (3)
    mockMemory.getByte.mockImplementation((addr: number) => {
      if (addr === dictionaryAddr) return 3; // Number of separators
      if (addr === dictionaryAddr + 1) return 32; // Space
      if (addr === dictionaryAddr + 2) return 46; // Period
      if (addr === dictionaryAddr + 3) return 44; // Comma
      if (addr === dictionaryAddr + 4) return 9; // Entry length
      return 0;
    });

    // Word 0: Entry count (positive for sorted, negative for unsorted)
    mockMemory.getWord.mockImplementation((addr: number) => {
      if (addr === dictionaryAddr + 5) return 100; // Number of entries (sorted)

      // For dictionary lookup testing
      if (addr === dictionaryAddr + 7) return 0x0600; // First entry address
      if (addr === dictionaryAddr + 7 + 9) return 0x0609; // Second entry address

      // Dictionary entry words (for token comparison)
      if (addr === 0x0600) return 0x1234; // First word of entry 1
      if (addr === 0x0602) return 0x5678; // Second word of entry 1
      if (addr === 0x0604) return 0x9abc; // Additional data for v4+

      if (addr === 0x0609) return 0x2345; // First word of entry 2
      if (addr === 0x060b) return 0x6789; // Second word of entry 2
      if (addr === 0x060d) return 0xabcd; // Additional data for v4+

      return 0;
    });
  });

  describe('Constructor', () => {
    it('should initialize with correct dictionary properties', () => {
      const dictionary = new Dictionary(mockMemory as unknown as Memory, dictionaryAddr, 3, { logger });

      expect(dictionary).toBeDefined();
      expect(dictionary.getSeparators()).toEqual([32, 46, 44]); // Space, period, comma
      expect(dictionary.getEntryLength()).toBe(9);
      expect(dictionary.getNumEntries()).toBe(100);
      expect(dictionary.isSorted()).toBe(true);
    });

    it('should handle unsorted dictionaries', () => {
      // Mock an unsorted dictionary (-100 entries)
      mockMemory.getWord.mockImplementationOnce((addr: number) => {
        if (addr === dictionaryAddr + 5) return -100; // Negative for unsorted
        return 0;
      });

      const dictionary = new Dictionary(mockMemory as unknown as Memory, dictionaryAddr, 3, { logger });

      expect(dictionary.getNumEntries()).toBe(100); // Should return absolute value
      expect(dictionary.isSorted()).toBe(false);
    });

    it('should interpret unsigned entry count as signed for dynamic dictionaries', () => {
      // When memory stores -1 as unsigned 16-bit, getWord returns 0xFFFF (65535).
      // Dictionary must interpret this as -1 (1 unsorted entry).
      mockMemory.getWord.mockImplementationOnce((addr: number) => {
        if (addr === dictionaryAddr + 5) return 0xffff; // -1 as unsigned 16-bit
        return 0;
      });

      const dictionary = new Dictionary(mockMemory as unknown as Memory, dictionaryAddr, 3, { logger });

      expect(dictionary.getNumEntries()).toBe(1);
      expect(dictionary.isSorted()).toBe(false);
    });

    it('should format separators as a readable string', () => {
      const dictionary = new Dictionary(mockMemory as unknown as Memory, dictionaryAddr, 3, { logger });
      const separatorsString = dictionary.getSeparatorsAsString();

      expect(separatorsString).toBe("' ', '.', ','");
    });
  });

  describe('Entry handling', () => {
    it('should calculate entry addresses correctly', () => {
      const dictionary = new Dictionary(mockMemory as unknown as Memory, dictionaryAddr, 3, { logger });

      // First entry
      expect(dictionary.getEntryAddress(0)).toBe(dictionaryAddr + 7);

      // Middle entry
      expect(dictionary.getEntryAddress(5)).toBe(dictionaryAddr + 7 + 5 * 9);

      // Last entry
      expect(dictionary.getEntryAddress(99)).toBe(dictionaryAddr + 7 + 99 * 9);
    });

    it('should throw error for out-of-range entry index', () => {
      const dictionary = new Dictionary(mockMemory as unknown as Memory, dictionaryAddr, 3, { logger });

      expect(() => dictionary.getEntryAddress(-1)).toThrow(/index out of range/);
      expect(() => dictionary.getEntryAddress(100)).toThrow(/index out of range/);
    });

    it('should extract entry data beyond the word', () => {
      const dictionary = new Dictionary(mockMemory as unknown as Memory, dictionaryAddr, 3, { logger });

      // Mock bytes for entry data
      mockMemory.getByte.mockImplementation((addr: number) => {
        if (addr === 0x0604) return 0x01; // Flag byte 1
        if (addr === 0x0605) return 0x02; // Flag byte 2
        if (addr === 0x0606) return 0x03; // Flag byte 3
        if (addr === 0x0607) return 0x04; // Flag byte 4
        if (addr === 0x0608) return 0x05; // Flag byte 5
        return 0;
      });

      const entryData = dictionary.getEntryData(0x0600);

      expect(entryData).toEqual({
        byte0: 0x01,
        byte1: 0x02,
        byte2: 0x03,
        byte3: 0x04,
        byte4: 0x05,
      });
    });
  });

  describe('Token comparison', () => {
    it('should correctly compare tokens with dictionary entries (v3)', () => {
      const dictionary = new Dictionary(mockMemory as unknown as Memory, dictionaryAddr, 3, { logger });

      // Match first word but not second
      expect(dictionary.compareTokenWords(0x0600, [0x1234, 0x0000])).toBe(0x5678);

      // Complete match
      expect(dictionary.compareTokenWords(0x0600, [0x1234, 0x5678])).toBe(0);

      // Mismatch on first word
      expect(dictionary.compareTokenWords(0x0600, [0x0000, 0x5678])).toBe(0x1234);
    });

    it('should correctly compare tokens for v4+ with third word', () => {
      // Set version to 4
      mockMemory.version = 4;
      const dictionary = new Dictionary(mockMemory as unknown as Memory, dictionaryAddr, 4, { logger });

      // Match first two words but not third
      expect(dictionary.compareTokenWords(0x0600, [0x1234, 0x5678, 0x0000])).toBe(0x9abc);

      // Complete match all three words
      expect(dictionary.compareTokenWords(0x0600, [0x1234, 0x5678, 0x9abc])).toBe(0);
    });
  });

  describe('Dictionary lookup', () => {
    it('should find a token using binary search for sorted dictionaries', () => {
      const dict = new Dictionary(mockMemory as unknown as Memory, dictionaryAddr, 3, { logger });
      const targetIndex = 50;
      const targetAddr = dict.getEntryAddress(targetIndex);

      // Use spyOn to track calls to compareTokenWords
      const compareSpy = vi.spyOn(dict, 'compareTokenWords');

      // Correctly guide the binary search algorithm based on its implementation
      // The Dictionary.compareTokenWords returns:
      // - negative if entry < token (we should search upper half)
      // - positive if entry > token (we should search lower half)
      // - zero if entry == token (we found it)
      compareSpy.mockImplementation((entryAddr: Address, encodedTokenWords: Array<number>): number => {
        // Calculate which index this address corresponds to
        const entryIndex = Math.floor((entryAddr - (dictionaryAddr + 7)) / 9);

        if (entryIndex === targetIndex) {
          return 0; // Exact match
        } else if (entryIndex < targetIndex) {
          return -1; // Current entry is less than target, search upper half
        } else {
          return 1; // Current entry is greater than target, search lower half
        }
      });

      const result = dict.lookupToken([0x1234, 0x5678]);

      expect(result).toBe(targetAddr);
      expect(compareSpy).toHaveBeenCalled();
    });

    it('should return 0 when token not found using binary search', () => {
      // Mock compareTokenWords to always return non-zero, but properly guide search
      const dict = new Dictionary(mockMemory as unknown as Memory, dictionaryAddr, 3, { logger });
      const compareSpy = vi.spyOn(dict, 'compareTokenWords');

      // This will converge to a point where lower > upper, simulating "not found"
      compareSpy.mockImplementation((entryAddr: Address, encodedTokenWords: Array<number>): number => {
        // Choose an invalid index that is never found
        const targetIndex = 1000;
        const entryIndex = Math.floor((entryAddr - (dictionaryAddr + 7)) / 9);

        if (entryIndex < targetIndex) {
          return -1; // Guide to upper half
        } else {
          return 1; // Guide to lower half
        }
      });

      const result = dict.lookupToken([0x1234, 0x5678]);

      expect(result).toBe(0);
    });

    it('should use linear search for unsorted dictionaries', () => {
      // Mock unsorted dictionary
      mockMemory.getWord.mockImplementationOnce((addr: number) => {
        if (addr === dictionaryAddr + 5) return -10; // Negative for unsorted, 10 entries
        return 0;
      });

      const dict = new Dictionary(mockMemory as unknown as Memory, dictionaryAddr, 3, { logger });
      const compareSpy = vi.spyOn(dict, 'compareTokenWords');

      // Force a match on the 5th entry
      compareSpy.mockImplementation((entryAddr: Address, encodedTokenWords: Array<number>): number => {
        if (entryAddr === dict.getEntryAddress(4)) {
          return 0; // Match at index 4
        }
        return 1; // No match otherwise
      });

      const result = dict.lookupToken([0x1234, 0x5678]);

      expect(result).toBe(dict.getEntryAddress(4));
      // Should have called compare for indices 0 through 4
      expect(compareSpy).toHaveBeenCalledTimes(5);
    });

    it('should return 0 when token not found using linear search', () => {
      // Mock unsorted dictionary
      mockMemory.getWord.mockImplementationOnce((addr: number) => {
        if (addr === dictionaryAddr + 5) return -10; // Negative for unsorted, 10 entries
        return 0;
      });

      const dict = new Dictionary(mockMemory as unknown as Memory, dictionaryAddr, 3, { logger });
      const compareSpy = vi.spyOn(dict, 'compareTokenWords');

      // Always return non-zero (never match)
      compareSpy.mockReturnValue(1);

      const result = dict.lookupToken([0x1234, 0x5678]);

      expect(result).toBe(0);
      // Should have called compare for all 10 entries
      expect(compareSpy).toHaveBeenCalledTimes(10);
    });
  });
});
