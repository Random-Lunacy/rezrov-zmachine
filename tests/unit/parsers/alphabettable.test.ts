import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Memory } from '../../../src/core/memory/Memory';
import { AlphabetTableManager } from '../../../src/parsers/AlphabetTable';
import { HeaderLocation } from '../../../src/utils/constants';
import { Logger, LogLevel } from '../../../src/utils/log';
import { MockMemory } from '../../mocks/MockMemory';

// Suppress console output during tests
Logger.setLogToConsole(false);
Logger.setLevel(LogLevel.ERROR);

describe('AlphabetTableManager', () => {
  // Mock memory for testing
  let mockMemory: MockMemory;
  let logger: Logger;

  // Set up before each test
  beforeEach(() => {
    // Create mock memory object
    mockMemory = new MockMemory();
    logger = new Logger('TestLogger');

    // Default behavior for version
    mockMemory.getByte.mockImplementation((addr: number) => {
      if (addr === HeaderLocation.Version) return 3;
      return 0;
    });

    // Default behavior for custom alphabet table (none)
    mockMemory.getWord.mockImplementation((addr: number) => {
      if (addr === HeaderLocation.AlphabetTable) return 0;
      return 0;
    });

    // Mock getAlphabetTables to return the default tables that match the implementation
    mockMemory.getAlphabetTables.mockReturnValue([
      'abcdefghijklmnopqrstuvwxyz',
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      ' \n0123456789.,!?_#\'"/\\-:()',
    ]);
  });

  describe('Default alphabet tables', () => {
    it('should return the correct default alphabet tables for version 1', () => {
      // Set version to 1
      mockMemory.getByte.mockImplementation((addr: number) => {
        if (addr === HeaderLocation.Version) return 1;
        return 0;
      });

      const alphabetManager = new AlphabetTableManager(mockMemory as unknown as Memory, { logger });
      const tables = alphabetManager.getAlphabetTables();

      // For V1, we need to override the mock to return V1 alphabet tables
      mockMemory.getAlphabetTables.mockReturnValue([
        'abcdefghijklmnopqrstuvwxyz',
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        ' 0123456789.,!?_#\'"/\\<-:()',
      ]);

      // Check V1 tables match spec
      expect(tables).toHaveLength(3);
      expect(tables[0]).toBe('abcdefghijklmnopqrstuvwxyz');
      expect(tables[1]).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
      expect(tables[2]).toBe(' 0123456789.,!?_#\'"/\\<-:()');
    });

    it('should return the correct default alphabet tables for version 2+', () => {
      // Set version to 3
      mockMemory.getByte.mockImplementation((addr: number) => {
        if (addr === HeaderLocation.Version) return 3;
        return 0;
      });

      const alphabetManager = new AlphabetTableManager(mockMemory as unknown as Memory, { logger });
      const tables = alphabetManager.getAlphabetTables();

      // Check default tables match spec
      expect(tables).toHaveLength(3);
      expect(tables[0]).toBe('abcdefghijklmnopqrstuvwxyz');
      expect(tables[1]).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
      // Note the newline character in the default table for version 2+
      expect(tables[2]).toBe(' \n0123456789.,!?_#\'"/\\-:()');
    });
  });

  describe('Custom alphabet tables', () => {
    it('should load a custom alphabet table for version 5', () => {
      // Set version to 5
      mockMemory.getByte.mockImplementation((addr: number) => {
        if (addr === HeaderLocation.Version) return 5;
        // Custom alphabet table characters (just for testing)
        if (addr >= 0x1000 && addr < 0x1000 + 78) {
          const index = addr - 0x1000;
          const alphabet = Math.floor(index / 26);
          const charPosition = index % 26;
          if (alphabet === 0) return 'A'.charCodeAt(0) + charPosition; // A-Z
          if (alphabet === 1) return 'a'.charCodeAt(0) + charPosition; // a-z
          return '0'.charCodeAt(0) + (charPosition % 10); // 0-9 repeated
        }
        return 0;
      });

      // Set custom alphabet table address
      mockMemory.getWord.mockImplementation((addr: number) => {
        if (addr === HeaderLocation.AlphabetTable) return 0x1000;
        return 0;
      });

      // Create a custom version of the mock for this test to bypass the default tables
      mockMemory.getAlphabetTables = vi.fn(); // Remove the default implementation

      const alphabetManager = new AlphabetTableManager(mockMemory as unknown as Memory, { logger });
      const tables = alphabetManager.getAlphabetTables();

      // Check custom tables were loaded
      expect(tables).toHaveLength(3);
      expect(tables[0]).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
      expect(tables[1]).toBe('abcdefghijklmnopqrstuvwxyz');
      expect(tables[2]).toBe('01234567890123456789012345');
    });

    it('should fall back to default tables if loading custom tables fails', () => {
      // Set version to 5
      mockMemory.getByte.mockImplementation((addr: number) => {
        if (addr === HeaderLocation.Version) return 5;
        if (addr === 0x1000) throw new Error('Memory access error');
        return 0;
      });

      // Set custom alphabet table address
      mockMemory.getWord.mockImplementation((addr: number) => {
        if (addr === HeaderLocation.AlphabetTable) return 0x1000;
        return 0;
      });

      const alphabetManager = new AlphabetTableManager(mockMemory as unknown as Memory, { logger });
      const tables = alphabetManager.getAlphabetTables();

      // Should fall back to default
      expect(tables).toHaveLength(3);
      expect(tables[0]).toBe('abcdefghijklmnopqrstuvwxyz');
      expect(tables[1]).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
      expect(tables[2]).toBe(' \n0123456789.,!?_#\'"/\\-:()');
    });

    it('should ignore custom alphabet tables for versions before 5', () => {
      // Set version to 3
      mockMemory.getByte.mockImplementation((addr: number) => {
        if (addr === HeaderLocation.Version) return 3;
        // Try to set up a custom table that should be ignored
        if (addr >= 0x1000 && addr < 0x1000 + 78) {
          return 'X'.charCodeAt(0);
        }
        return 0;
      });

      // Set custom alphabet table address that should be ignored for v3
      mockMemory.getWord.mockImplementation((addr: number) => {
        if (addr === HeaderLocation.AlphabetTable) return 0x1000;
        return 0;
      });

      const alphabetManager = new AlphabetTableManager(mockMemory as unknown as Memory, { logger });
      const tables = alphabetManager.getAlphabetTables();

      // Should use default tables for v3
      expect(tables).toHaveLength(3);
      expect(tables[0]).toBe('abcdefghijklmnopqrstuvwxyz');
      expect(tables[1]).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
      expect(tables[2]).toBe(' \n0123456789.,!?_#\'"/\\-:()');
    });
  });

  describe('Character lookup', () => {
    it('should get characters from the correct alphabet', () => {
      const alphabetManager = new AlphabetTableManager(mockMemory as unknown as Memory, { logger });

      // Test characters from each alphabet
      expect(alphabetManager.getCharacterFromAlphabet(0, 11)).toBe('f'); // A0, zChar 11 = 'f'
      expect(alphabetManager.getCharacterFromAlphabet(1, 21)).toBe('P'); // A1, zChar 21 = 'P'
      expect(alphabetManager.getCharacterFromAlphabet(2, 13)).toBe('5'); // A2, zChar 13 = '5'
    });

    it('should handle special cases like newline', () => {
      const alphabetManager = new AlphabetTableManager(mockMemory as unknown as Memory, { logger });

      // Newline is special case in A2
      expect(alphabetManager.getCharacterFromAlphabet(2, 7)).toBe('\n');

      // ZSCII escape is handled elsewhere
      expect(alphabetManager.getCharacterFromAlphabet(2, 6)).toBe('');
    });

    it('should return ? for invalid character indices', () => {
      const alphabetManager = new AlphabetTableManager(mockMemory as unknown as Memory, { logger });

      // Invalid index should return ?
      expect(alphabetManager.getCharacterFromAlphabet(0, 100)).toBe('?');
      expect(alphabetManager.getCharacterFromAlphabet(1, 50)).toBe('?');
      expect(alphabetManager.getCharacterFromAlphabet(2, 40)).toBe('?');
    });
  });

  describe('Z-character lookup', () => {
    it('should find the correct alphabet and z-character for a given character', () => {
      const alphabetManager = new AlphabetTableManager(mockMemory as unknown as Memory);

      // Lookup characters from each alphabet
      expect(alphabetManager.getZCharForCharacter('h')).toEqual({ alphabet: 0, zChar: 13 });
      expect(alphabetManager.getZCharForCharacter('T')).toEqual({ alphabet: 1, zChar: 25 });
      expect(alphabetManager.getZCharForCharacter('5')).toEqual({ alphabet: 2, zChar: 13 });
    });

    it('should handle special case for newline', () => {
      const alphabetManager = new AlphabetTableManager(mockMemory as unknown as Memory);

      expect(alphabetManager.getZCharForCharacter('\n')).toEqual({ alphabet: 2, zChar: 7 });
    });

    it('should return null for characters not found in any alphabet', () => {
      const alphabetManager = new AlphabetTableManager(mockMemory as unknown as Memory);

      // Character not in any alphabet
      expect(alphabetManager.getZCharForCharacter('€')).toBeNull();
    });
  });
});
