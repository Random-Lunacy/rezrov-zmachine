import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Memory } from '../../../src/core/memory/Memory';
import { decodeZString, encodeZString, packZCharacters } from '../../../src/parsers/ZString';
import { HeaderLocation } from '../../../src/utils/constants';
import { Logger, LogLevel } from '../../../src/utils/log';
import { MockMemory } from '../../mocks/MockMemory';

// Suppress console output during tests
Logger.setLogToConsole(false);
Logger.setLevel(LogLevel.ERROR);

describe('ZString', () => {
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

    // Mock abbreviation table access
    mockMemory.getWord.mockImplementation((addr: number) => {
      if (addr === HeaderLocation.AbbreviationsTable) return 0x0e00;
      if (addr >= 0x0e00 && addr < 0x0f00) {
        // Mock abbreviation table entry pointing to 0x1000
        return 0x0800; // Will become 0x1000 after unpacking (address * 2)
      }
      return 0;
    });

    // Mock getZString for abbreviation lookups
    mockMemory.getZString.mockImplementation((addr: number) => {
      if (addr === 0x1000) {
        // Simple abbreviation that decodes to "the "
        return [0, 20, 13, 14, 0];
      }
      return [];
    });

    // Mock getAlphabetTables to return standard alphabet tables
    mockMemory.getAlphabetTables.mockReturnValue([
      'abcdefghijklmnopqrstuvwxyz',
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      ' \n0123456789.,!?_#\'"/\\-:()',
    ]);

    // Add zsciiToUnicode method to the mock
    // This matches the implementation you shared
    mockMemory.zsciiToUnicode = vi.fn().mockImplementation((zscii: number) => {
      // Handle standard ASCII range
      if (zscii >= 32 && zscii <= 126) {
        return zscii; // Standard ASCII characters map directly
      }

      // Handle newline
      if (zscii === 13) {
        return 10; // Convert to LF
      }

      // Default to question mark for undefined characters
      return 63; // '?'
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('decodeZString', () => {
    it('should decode basic Z-strings correctly', () => {
      // Example Z-string encoding "hello"
      // 'h' is zchar 13 in A0, 'e' is zchar 11, 'l' is zchar 17, 'o' is zchar 20
      const zString = [13, 10, 17, 17, 20];
      const result = decodeZString(mockMemory as unknown as Memory, zString);
      expect(result).toBe('hello');
    });

    it('should handle alphabet shifts', () => {
      // Z-string with shifts between alphabets
      // A0(h) + A0(e) + A0(l) + A0(l) + A0(o) + shift to A1 + A1(W) + A0(o) + A0(r) + A0(l) + A0(d)
      const zString = [13, 10, 17, 17, 20, 4, 28, 20, 23, 17, 9];
      const result = decodeZString(mockMemory as unknown as Memory, zString);
      // In V3, shifts only affect the next character
      expect(result).toBe('helloWorld');
    });

    it('should handle multiple alphabet shifts to create uppercase text', () => {
      // Z-string with multiple shifts to A1
      // A0(h) + A0(e) + A0(l) + A0(l) + A0(o) + shift to A1 + A1(W) + shift to A1 + A1(O) + shift to A1 + A1(R) + shift to A1 + A1(L) + shift to A1 + A1(D)
      const zString = [13, 10, 17, 17, 20, 4, 28, 4, 20, 4, 23, 4, 17, 4, 9];
      const result = decodeZString(mockMemory as unknown as Memory, zString);
      expect(result).toBe('helloWORLD');
    });

    describe('V1-2 specific shift behavior', () => {
      beforeEach(() => {
        // Set version to 2 for all tests in this describe block
        mockMemory.getByte.mockImplementation((addr: number) => {
          if (addr === HeaderLocation.Version) return 2;
          return 0;
        });
      });

      afterEach(() => {
        // Reset version to 3 after each test
        mockMemory.getByte.mockImplementation((addr: number) => {
          if (addr === HeaderLocation.Version) return 3;
          return 0;
        });
      });

      it('should handle single-character shifts with Z-char 2', () => {
        // From A0 -> A1: 'h' (A0) + shift to A1 (2) + 'A' (A1) + 'i' (A0)
        let zString = [13, 2, 6, 14];
        let result = decodeZString(mockMemory as unknown as Memory, zString);
        expect(result).toBe('hAi');

        // From A1 -> A2: shift to A1 (4) + 'A' (A1) + shift to A2 (2) + '1' (A2) + 'B' (A1)
        zString = [4, 6, 2, 13, 7];
        result = decodeZString(mockMemory as unknown as Memory, zString);
        expect(result).toBe('A1B');

        // From A2 -> A0: shift to A2 (5) + '1' (A2) + shift to A0 (2) + 'a' (A0) + '2' (A2)
        zString = [5, 13, 2, 6, 14];
        result = decodeZString(mockMemory as unknown as Memory, zString);
        expect(result).toBe('1a2');
      });

      it('should handle single-character shifts with Z-char 3', () => {
        // From A0 -> A2: 'h' (A0) + shift to A2 (3) + '1' (A2) + 'i' (A0)
        let zString = [13, 3, 13, 14];
        let result = decodeZString(mockMemory as unknown as Memory, zString);
        expect(result).toBe('h1i');

        // From A1 -> A0: shift to A1 (4) + 'A' (A1) + shift to A0 (3) + 'a' (A0) + 'B' (A1)
        zString = [4, 6, 3, 6, 7];
        result = decodeZString(mockMemory as unknown as Memory, zString);
        expect(result).toBe('AaB');

        // From A2 -> A1: shift to A2 (5) + '1' (A2) + shift to A1 (3) + 'A' (A1) + '2' (A2)
        zString = [5, 13, 3, 6, 14];
        result = decodeZString(mockMemory as unknown as Memory, zString);
        expect(result).toBe('1A2');
      });

      it('should maintain shift lock until single-character shift is used', () => {
        // Shift lock to A1 (4) + 'ABC' (A1) + single shift to A0 (3) + 'a' (A0) + 'DEF' (A1)
        const zString = [4, 6, 7, 8, 3, 6, 9, 10, 11];
        const result = decodeZString(mockMemory as unknown as Memory, zString);
        expect(result).toBe('ABCaDEF');
      });

      it('should allow shifting between all three alphabets in sequence', () => {
        // A complex sequence using all shift mechanisms:
        // 'a' (A0) + shift lock to A1 (4) + 'B' (A1) + single shift to A2 (2) + '1' (A2) +
        // 'C' (A1) + single shift to A0 (3) + 'b' (A0) + 'D' (A1) + shift lock to A2 (5) +
        // '23' (A2) + single shift to A1 (3) + 'E' (A1) + '4' (A2)
        const zString = [6, 4, 7, 2, 13, 8, 3, 7, 9, 5, 14, 15, 3, 10, 16];
        const result = decodeZString(mockMemory as unknown as Memory, zString);
        expect(result).toBe('aB1CbD23E4');
      });

      it('should handle combinations of single shifts and shift locks', () => {
        // Start in A0, use single shifts and locks in combination
        // 'hi' (A0) + single shift to A1 (2) + 'A' (A1) + 'j' (A0) +
        // shift lock to A1 (4) + 'BC' (A1) + single shift to A2 (2) + '1' (A2) +
        // 'D' (A1) + shift lock to A2 (5) + '23' (A2) + single shift to A0 (2) + 'k' (A0) + '4' (A2)
        const zString = [13, 14, 2, 6, 15, 4, 7, 8, 2, 13, 9, 5, 14, 15, 2, 16, 16];
        const result = decodeZString(mockMemory as unknown as Memory, zString);
        expect(result).toBe('hiAjBC1D23k4');
      });
    });

    it('should handle space character', () => {
      // Z-char 0 is space
      const zString = [13, 10, 17, 17, 20, 0, 29, 20, 23, 17, 9];
      const result = decodeZString(mockMemory as unknown as Memory, zString);
      expect(result).toBe('hello world');
    });

    it('should handle abbreviations', () => {
      // Z-string with abbreviation (char 1 followed by index)
      const zString = [1, 5, 13, 10, 17, 17, 20];
      const result = decodeZString(mockMemory as unknown as Memory, zString);
      // Abbreviation 1,5 should expand to "the " + "hello"
      expect(result).toBe('the hello');
    });

    it('should handle multiple abbreviations', () => {
      // Z-string with multiple abbreviations
      const zString = [1, 5, 13, 10, 17, 17, 20, 0, 1, 5, 29, 20, 23, 17, 9];
      const result = decodeZString(mockMemory as unknown as Memory, zString);
      // Should expand to "the hello the world"
      expect(result).toBe('the hello the world');
    });

    it('should handle newline character', () => {
      // Newline is A2 char 7
      const zString = [13, 10, 17, 17, 20, 5, 7, 29, 20, 23, 17, 9];
      const result = decodeZString(mockMemory as unknown as Memory, zString);
      expect(result).toBe('hello\nworld');
    });

    it('should handle version 1-2 shift lock behavior', () => {
      // Set version to 2
      mockMemory.getByte.mockImplementation((addr: number) => {
        if (addr === HeaderLocation.Version) return 2;
        return 0;
      });

      // In v1-2, shift chars 4 and 5 lock the shift
      const zString = [13, 10, 17, 17, 20, 4, 23, 24, 28, 8, 5, 13, 14, 15];
      const result = decodeZString(mockMemory as unknown as Memory, zString);

      // After shifting to A1 with char 4, all chars should be from A1 until another shift
      // After shifting to A2 with char 5, all chars should be from A2
      expect(result).toBe('helloRSWC789');
    });

    it('should handle ZSCII escape sequences in V5+', () => {
      // Set version to 5
      mockMemory.getByte.mockImplementation((addr: number) => {
        if (addr === HeaderLocation.Version) return 5;
        return 0;
      });

      // ZSCII escape is A2 char 6, followed by two 5-bit values that make a 10-bit unicode char
      // Example: A2(6) + 0x03 + 0x08 = unicode char 0x0068 = 'h'
      const zString = [5, 6, 3, 8, 11, 17, 17, 20];
      const result = decodeZString(mockMemory as unknown as Memory, zString);

      // The unicode char should be converted through zsciiToUnicode
      // (3 << 5 | 8) = 104 = 'h' in ASCII
      expect(result).toBe('hello');
      expect(mockMemory.zsciiToUnicode).toHaveBeenCalledWith(104);
    });

    it('should handle incomplete ZSCII escape sequences by adding a ?', () => {
      // Set version to 5
      mockMemory.getByte.mockImplementation((addr: number) => {
        if (addr === HeaderLocation.Version) return 5;
        return 0;
      });

      // ZSCII escape missing second byte
      const zString = [5, 6, 3];
      const result = decodeZString(mockMemory as unknown as Memory, zString);

      // Should insert a ? for the incomplete sequence
      expect(result).toBe('?');
    });

    it('should handle alphabets resetting after shift in V3+', () => {
      // In V3+, shifts are temporary
      const zString = [13, 10, 17, 17, 20, 4, 23, 11, 17, 17, 20];
      const result = decodeZString(mockMemory as unknown as Memory, zString);

      // After shifting to A1 with char 4, only the next char should be from A1
      // then it should revert to A0
      expect(result).toBe('helloRello');
    });

    it('should return ? for invalid character indices', () => {
      // Out of bounds character index
      const zString = [13, 10, 17, 17, 20, 4, 60];
      const result = decodeZString(mockMemory as unknown as Memory, zString);

      // Should insert a ? for the invalid character
      expect(result).toBe('hello?');
    });

    it('should not expand abbreviations when expandAbbreviations is false', () => {
      // Z-string with abbreviation
      const zString = [1, 5, 13, 10, 17, 17, 20];
      const result = decodeZString(mockMemory as unknown as Memory, zString, false);

      // Should not expand the abbreviation
      expect(result).not.toContain('the');
    });
  });

  describe('encodeZString', () => {
    it('should encode basic lowercase text correctly', () => {
      const text = 'hello';
      const result = encodeZString(mockMemory as unknown as Memory, text, 3);

      // 'h' is zchar 13 in A0, 'e' is zchar 11, 'l' is zchar 17, 'o' is zchar 20
      expect(result).toEqual([13, 10, 17, 17, 20, 5]); // Last 5 is padding
    });

    it('should encode with alphabet shifts for uppercase', () => {
      const text = 'Hello';
      const result = encodeZString(mockMemory as unknown as Memory, text, 3);

      // Shift to A1 (4) for 'H' (13), then back to A0 for 'ello'
      expect(result).toEqual([4, 13, 10, 17, 17, 20]);
    });

    it('should encode with alphabet shifts for punctuation', () => {
      const text = 'hello!';
      const result = encodeZString(mockMemory as unknown as Memory, text, 3);

      // Regular chars for 'hello', then shift to A2 (5) for '!' (17)
      expect(result).toEqual([13, 10, 17, 17, 20, 5, 17]);
    });

    it('should handle spaces correctly', () => {
      const text = 'hello world';
      const result = encodeZString(mockMemory as unknown as Memory, text, 3);

      // Space is special char 0
      expect(result).toEqual([13, 10, 17, 17, 20, 0, 29, 20, 23, 17, 9]);
    });

    it('should handle newlines correctly', () => {
      const text = 'hello\nworld';
      const result = encodeZString(mockMemory as unknown as Memory, text, 3);

      // Newline is A2 char 7
      expect(result).toEqual([13, 10, 17, 17, 20, 5, 7, 29, 20, 23, 17, 9]);
    });

    it('should encode ASCII characters using ZSCII escape in V5+', () => {
      const text = 'hello@'; // @ is not in standard alphabets
      const result = encodeZString(mockMemory as unknown as Memory, text, 5);

      // Regular encoding for 'hello'
      // Then shift to A2 (5), ZSCII escape (6), high bits, low bits for '@' (ASCII 64 = 0x40 = 0b01000000)
      expect(result).toEqual([13, 10, 17, 17, 20, 5, 6, 2, 0]);
    });

    it('should pad short strings to full resolution length', () => {
      const text = 'hi';

      // For V3, resolution is 2 words (6 Z-chars)
      const resultV3 = encodeZString(mockMemory as unknown as Memory, text, 3);
      expect(resultV3.length).toBe(6);
      expect(resultV3).toEqual([13, 14, 5, 5, 5, 5]);

      // For V5, resolution is 3 words (9 Z-chars)
      const resultV5 = encodeZString(mockMemory as unknown as Memory, text, 5);
      expect(resultV5.length).toBe(9);
      expect(resultV5).toEqual([13, 14, 5, 5, 5, 5, 5, 5, 5]);
    });

    it('should limit string length to resolution length', () => {
      // Very long string
      const longText = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

      // For V3, should be limited to 6 Z-chars (2 words)
      const resultV3 = encodeZString(mockMemory as unknown as Memory, longText, 3);
      expect(resultV3.length).toBe(6);

      // For V5, should be limited to 9 Z-chars (3 words)
      const resultV5 = encodeZString(mockMemory as unknown as Memory, longText, 5);
      expect(resultV5.length).toBe(9);
    });

    it('should use custom padding value when specified', () => {
      const text = 'a';
      const result = encodeZString(mockMemory as unknown as Memory, text, 3, 10); // Use padding value 10

      // 'a' is zchar 6 in A0, rest should be padding value 10
      expect(result).toEqual([6, 10, 10, 10, 10, 10]);
    });
  });

  describe('packZCharacters', () => {
    it('should pack 3 Z-chars into one word for V1-V3', () => {
      const zChars = [13, 11, 17]; // 'hel'
      const result = packZCharacters(zChars, 3);

      // Only packs into one word for V1-V3
      expect(result.length).toBe(1);

      // Formula: (char1 << 10) | (char2 << 5) | char3
      // (13 << 10) | (11 << 5) | 17 = 13312 + 352 + 17 = 13681
      // Set terminator bit on last word: 13681 | 0x8000 = 46449
      expect(result[0]).toBe(13681 | 0x8000);
    });

    it('should pack 6 Z-chars into two words for V1-V3', () => {
      const zChars = [13, 10, 17, 17, 20, 29]; // 'hellow'
      const result = packZCharacters(zChars, 3);

      // For V1-V3, resolution is 2 words
      expect(result.length).toBe(2);

      // First word: (13 << 10) | (11 << 5) | 17 = 13312 + 352 + 17 = 13681
      // Second word: (17 << 10) | (20 << 5) | 29 = 17408 + 640 + 29 = 18077
      // Set terminator bit on last word: 18077 | 0x8000 = 50845
      expect(result[0]).toBe(13681);
      expect(result[1]).toBe(18077 | 0x8000);
    });

    it('should pack 9 Z-chars into three words for V4+', () => {
      const zChars = [13, 10, 17, 17, 20, 29, 20, 23, 17]; // 'hellowor'
      const result = packZCharacters(zChars, 5);

      // For V4+, resolution is 3 words
      expect(result.length).toBe(3);

      // First word: (13 << 10) | (11 << 5) | 17 = 13312 + 352 + 17 = 13681
      // Second word: (17 << 10) | (20 << 5) | 29 = 17408 + 640 + 29 = 18077
      // Third word: (20 << 10) | (23 << 5) | 17 = 20480 + 736 + 17 = 21233
      // Set terminator bit on last word: 21233 | 0x8000 = 53921
      expect(result[0]).toBe(13681);
      expect(result[1]).toBe(18077);
      expect(result[2]).toBe(21233 | 0x8000);
    });

    it('should pad with zeros for incomplete sequences', () => {
      const zChars = [13, 11]; // 'he'
      const result = packZCharacters(zChars, 3);

      // Should pad with zero for third char in word
      // (13 << 10) | (11 << 5) | 0 = 13312 + 352 + 0 = 13664
      // Set terminator bit: 13664 | 0x8000 = 46432
      expect(result[0]).toBe(13664 | 0x8000);
    });

    it('should set terminator bit on last word only', () => {
      // 7 chars (3 words in V5+)
      const zChars = [13, 10, 17, 17, 20, 29, 20];
      const result = packZCharacters(zChars, 5);

      // Check that only the last word has the terminator bit set (0x8000)
      expect(result[0] & 0x8000).toBe(0);
      expect(result[1] & 0x8000).toBe(0);
      expect(result[2] & 0x8000).toBe(0x8000);
    });
  });

  describe('Integration tests', () => {
    it('should round-trip encode-decode correctly for simple text', () => {
      const originalText = 'hello world';

      // Encode the text
      const encoded = encodeZString(mockMemory as unknown as Memory, originalText, 3);

      // Decode the Z-string
      const decoded = decodeZString(mockMemory as unknown as Memory, encoded);

      // Should match original (keeping in mind length limitations)
      expect(decoded).toBe('hello wo'); // Limited by V3 resolution (2 words = 6 chars)
    });

    it('should round-trip encode-decode correctly for V5 with longer text', () => {
      // Set version to 5
      mockMemory.getByte.mockImplementation((addr: number) => {
        if (addr === HeaderLocation.Version) return 5;
        return 0;
      });

      const originalText = 'hello world';

      // Encode the text
      const encoded = encodeZString(mockMemory as unknown as Memory, originalText, 5);

      // Decode the Z-string
      const decoded = decodeZString(mockMemory as unknown as Memory, encoded);

      // Should match original (with V5's longer resolution)
      expect(decoded).toBe('hello worl'); // Limited by V5 resolution (3 words = 9 chars)
    });

    it('should round-trip pack-decode correctly', () => {
      // Encode text to Z-chars
      const zChars = [13, 10, 17, 17, 20]; // 'hello'

      // Pack the Z-chars into words
      const packed = packZCharacters(zChars, 3);

      // Create a Z-string from the packed words (simulating how memory would retrieve it)
      const zString: number[] = [];
      for (let i = 0; i < packed.length; i++) {
        const word = packed[i];
        // Extract the three Z-chars from each word
        zString.push((word >> 10) & 0x1f);
        zString.push((word >> 5) & 0x1f);
        zString.push(word & 0x1f);

        // If this is the last word (terminator bit set), stop
        if (word & 0x8000) break;
      }

      // Decode the Z-string
      const decoded = decodeZString(mockMemory as unknown as Memory, zString);

      // Should match the original text
      expect(decoded).toBe('hello');
    });
  });
});
