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
        return [25, 13, 10, 0];
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

    it('should handle space character', () => {
      // Z-char 0 is space
      const zString = [13, 10, 17, 17, 20, 0, 28, 20, 23, 17, 9];
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
      const zString = [1, 5, 13, 10, 17, 17, 20, 0, 1, 5, 28, 20, 23, 17, 9];
      const result = decodeZString(mockMemory as unknown as Memory, zString);
      // Should expand to "the hello the world"
      expect(result).toBe('the hello the world');
    });

    it('should handle newline character', () => {
      // Newline is A2 char 7
      const zString = [13, 10, 17, 17, 20, 5, 7, 28, 20, 23, 17, 9];
      const result = decodeZString(mockMemory as unknown as Memory, zString);
      expect(result).toBe('hello\nworld');
    });

    it('should handle ZSCII escape sequences', () => {
      // Set version to 5
      mockMemory.getByte.mockImplementation((addr: number) => {
        if (addr === HeaderLocation.Version) return 5;
        return 0;
      });

      // ZSCII escape is A2 char 6, followed by two 5-bit values that make a 10-bit unicode char
      // Example: A2(6) + 0x03 + 0x08 = unicode char 0x0068 = 'h'
      const zString = [5, 6, 3, 8, 10, 17, 17, 20];
      const result = decodeZString(mockMemory as unknown as Memory, zString);

      // The unicode char should be converted through zsciiToUnicode
      // (3 << 5 | 8) = 104 = 'h' in ASCII
      expect(result).toBe('hello');
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
      const zString = [13, 10, 17, 17, 20, 4, 13, 10, 17, 17, 20];
      const result = decodeZString(mockMemory as unknown as Memory, zString);

      // After shifting to A1 with char 4, only the next char should be from A1
      // then it should revert to A0
      expect(result).toBe('helloHello');
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
      // Last character is padding (5)
      expect(result).toEqual([13, 10, 17, 17, 20, 5]);
    });

    it('should convert uppercase to lowercase for dictionary encoding', () => {
      const text = 'Hello';
      const result = encodeZString(mockMemory as unknown as Memory, text, 3);

      // Should convert to lowercase before encoding
      expect(result).toEqual([13, 10, 17, 17, 20, 5]);
    });

    it('should handle word separators as separate words', () => {
      // Test a single separator character
      const comma = ',';
      const resultComma = encodeZString(mockMemory as unknown as Memory, comma, 3);

      // Shift to A2 (5) + comma code (expected to be at position 13 in A2)
      // Note: adjust index if necessary based on your alphabet table
      expect(resultComma).toEqual([5, 19, 5, 5, 5, 5]);

      // Test period
      const period = '.';
      const resultPeriod = encodeZString(mockMemory as unknown as Memory, period, 3);

      // Shift to A2 (5) + period code (expected to be at position 12 in A2)
      expect(resultPeriod).toEqual([5, 18, 5, 5, 5, 5]);
    });

    it('should stop encoding at the first word separator', () => {
      const text = 'hello, world';
      const result = encodeZString(mockMemory as unknown as Memory, text, 3);

      // Should only encode 'hello'
      expect(result).toEqual([13, 10, 17, 17, 20, 5]);
    });

    it('should stop encoding at the first space', () => {
      const text = 'hello world';
      const result = encodeZString(mockMemory as unknown as Memory, text, 3);

      // Should only encode 'hello'
      expect(result).toEqual([13, 10, 17, 17, 20, 5]);
    });

    it('should stop encoding at a new line', () => {
      const text = 'hello\nworld';
      const result = encodeZString(mockMemory as unknown as Memory, text, 3);

      // Should only encode 'hello'
      expect(result).toEqual([13, 10, 17, 17, 20, 5]);
    });

    it('should include non-separator punctuation as part of the word', () => {
      const text = "don't";
      const result = encodeZString(mockMemory as unknown as Memory, text, 3);

      // Should encode the apostrophe as part of the word
      // Adjust expected values based on actual alphabet tables
      const apostropheIndex = mockMemory.getAlphabetTables()[2].indexOf("'");
      const apostropheZChar = apostropheIndex + 6;

      // 'd', 'o', 'n', shift to A2, apostrophe, 't'
      expect(result.slice(0, 6)).toEqual([9, 20, 19, 5, apostropheZChar, 25]);
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

    it('should truncate strings that exceed resolution length', () => {
      // A string with special characters that would exceed resolution when encoded
      const text = 'a"b\'c'; // encoding would need shift characters
      const result = encodeZString(mockMemory as unknown as Memory, text, 3);

      // Should stop at the first word separator (")
      // So only 'a' should be encoded
      expect(result).toEqual([6, 5, 5, 5, 5, 5]);
    });

    it('should use custom padding value when specified', () => {
      const text = 'a';
      const result = encodeZString(mockMemory as unknown as Memory, text, 3, 10); // Use padding value 10

      // 'a' is zchar 6 in A0, rest should be padding value 10
      expect(result).toEqual([6, 10, 10, 10, 10, 10]);
    });

    it('should allow custom word separators', () => {
      const text = 'hello! world';
      // Use ! as a word separator instead of default
      const result = encodeZString(mockMemory as unknown as Memory, text, 3, 5, ['!']);

      // Should stop at the ! character
      expect(result).toEqual([13, 10, 17, 17, 20, 5]);
    });
  });

  describe('ZSCII escape sequence encoding', () => {
    it('should encode characters not in alphabet tables using ZSCII escape', () => {
      // Test a character that's not in any alphabet table (e.g., '@' = 64)
      const text = '@';
      const result = encodeZString(mockMemory as unknown as Memory, text, 3);

      // Should be: shift to A2 (5), ZSCII escape (6), top bits (2), bottom bits (0)
      // 64 = 0100 0000 = top 2 bits (01) + bottom 5 bits (00000)
      const expectedZChars = [5, 6, 2, 0, 5, 5]; // padded to 6 chars
      expect(result).toEqual(expectedZChars);
    });

    it('should encode multiple ZSCII escape characters', () => {
      const text = '@$'; // Both characters require ZSCII escape
      const result = encodeZString(mockMemory as unknown as Memory, text, 5); // V5 for longer resolution

      // '@' = 64: shift(5) + escape(6) + top(2) + bottom(0)
      // '$' = 36: shift(5) + escape(6) + top(1) + bottom(4)
      const expectedZChars = [5, 6, 2, 0, 5, 6, 1, 4, 5]; // padded to 9 chars for V5
      expect(result).toEqual(expectedZChars);
    });

    it('should handle mixed regular and ZSCII escape characters', () => {
      const text = 'a@b';
      const result = encodeZString(mockMemory as unknown as Memory, text, 5);

      // 'a' = A0 char (6), '@' = ZSCII escape, 'b' = A0 char (7)
      const expectedZChars = [6, 5, 6, 2, 0, 7, 5, 5, 5]; // padded to 9 chars
      expect(result).toEqual(expectedZChars);
    });

    it('should round-trip encode-decode ZSCII escape sequences correctly', () => {
      // Test characters that are NOT in the standard alphabet tables
      // > is commonly used as input prompt in story files
      const testChars = ['@', '$', '%', '&', '*', '+', '=', '<', '>', '~'];

      for (const char of testChars) {
        // Encode the character
        const encoded = encodeZString(mockMemory as unknown as Memory, char, 5);

        // Verify it uses ZSCII escape (should start with shift to A2 + escape marker)
        expect(encoded[0]).toBe(5); // Shift to A2
        expect(encoded[1]).toBe(6); // ZSCII escape marker

        // Decode the Z-string
        const decoded = decodeZString(mockMemory as unknown as Memory, encoded);

        // Should match original character
        expect(decoded).toBe(char);
      }
    });

    it('should round-trip encode-decode mixed text with ZSCII escapes', () => {
      // Test a realistic scenario with mixed regular and ZSCII escape characters
      const originalText = 'score>'; // Common in IF games

      // Encode the text
      const encoded = encodeZString(mockMemory as unknown as Memory, originalText, 5);

      // Decode the Z-string
      const decoded = decodeZString(mockMemory as unknown as Memory, encoded);

      // Should match original (truncated to fit resolution)
      expect(decoded).toBe('score>'); // Should fit in 9 Z-chars for V5
    });

    it('should round-trip specific prompt character', () => {
      // Specifically test the > character since it's mentioned as important
      const promptChar = '>';

      // Encode
      const encoded = encodeZString(mockMemory as unknown as Memory, promptChar, 3);

      // Verify ZSCII escape structure
      expect(encoded[0]).toBe(5); // Shift to A2
      expect(encoded[1]).toBe(6); // ZSCII escape

      // Calculate expected values for > (ASCII 62)
      // 62 = 0111110 = 01 11110 = top bits 1, bottom bits 30
      expect(encoded[2]).toBe(1); // Top bits
      expect(encoded[3]).toBe(30); // Bottom bits

      // Decode and verify
      const decoded = decodeZString(mockMemory as unknown as Memory, encoded);
      expect(decoded).toBe('>');
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

      // First word: (13 << 10) | (10 << 5) | 17 = 13312 + 320 + 17 = 13649
      // Second word: (17 << 10) | (20 << 5) | 29 = 17408 + 640 + 29 = 18077
      // Set terminator bit on last word: 18077 | 0x8000 = 50845
      expect(result[0]).toBe(13649);
      expect(result[1]).toBe(18077 | 0x8000);
    });

    it('should pack 9 Z-chars into three words for V4+', () => {
      const zChars = [13, 10, 17, 17, 20, 29, 20, 23, 17]; // 'hellowor'
      const result = packZCharacters(zChars, 5);

      // For V4+, resolution is 3 words
      expect(result.length).toBe(3);

      // First word: (13 << 10) | (10 << 5) | 17 = 13312 + 320 + 17 = 13649
      // Second word: (17 << 10) | (20 << 5) | 29 = 17408 + 640 + 29 = 18077
      // Third word: (20 << 10) | (23 << 5) | 17 = 20480 + 736 + 17 = 21233
      // Set terminator bit on last word: 21233 | 0x8000 = 53921
      expect(result[0]).toBe(13649);
      expect(result[1]).toBe(18077);
      expect(result[2]).toBe(21233 | 0x8000);
    });

    it('should pad with 5 for incomplete sequences', () => {
      const zChars = [13, 11]; // 'he'
      const result = packZCharacters(zChars, 3);

      // Should pad with 5 (shift to A2) for third char in word
      // (13 << 10) | (11 << 5) | 5 = 13312 + 352 + 5 = 13669
      // Set terminator bit: 13669 | 0x8000 = 46437
      expect(result[0]).toBe(13669 | 0x8000);
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
      const originalText = 'helloworld';

      // Encode the text
      const encoded = encodeZString(mockMemory as unknown as Memory, originalText, 3);

      // Decode the Z-string
      const decoded = decodeZString(mockMemory as unknown as Memory, encoded);

      // Should match original (keeping in mind character length limitations)
      expect(decoded).toBe('hellow'); // Limited by V3 resolution (2 words = 6 chars)
    });

    it('should round-trip encode-decode correctly for V5 with longer text', () => {
      // Set version to 5
      mockMemory.getByte.mockImplementation((addr: number) => {
        if (addr === HeaderLocation.Version) return 5;
        return 0;
      });

      const originalText = 'helloworld';

      // Encode the text
      const encoded = encodeZString(mockMemory as unknown as Memory, originalText, 5);

      // Decode the Z-string
      const decoded = decodeZString(mockMemory as unknown as Memory, encoded);

      // Should match original (with V5's longer resolution)
      expect(decoded).toBe('helloworl'); // Limited by V5 resolution (3 words = 9 chars)
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

  describe('V1-2 specific shift behavior', () => {
    beforeEach(() => {
      // Set version to 2 for all tests in this describe block
      mockMemory.getByte.mockImplementation((addr: number) => {
        if (addr === HeaderLocation.Version) return 2;
        return 0;
      });

      // For V2, the correct alphabet table has \n as the second character in A2
      mockMemory.getAlphabetTables.mockReturnValue([
        'abcdefghijklmnopqrstuvwxyz',
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        ' \n0123456789.,!?_#\'"/\\-:()',
      ]);
    });

    it('should handle version 1-2 shift lock behavior', () => {
      // Z-string with shifts between alphabets
      // A0(h) + A0(e) + A0(l) + A0(l) + A0(o) + shift lock to A1 + A1(R) + A1(S) + A1(W) + A1(C) + shift lock to A0 + A0(b) + A0(h) + A0(i)
      const zString = [13, 10, 17, 17, 20, 4, 23, 24, 28, 8, 5, 7, 13, 14];
      const result = decodeZString(mockMemory as unknown as Memory, zString);

      // After shifting to A1 with char 4, all chars should be from A1 until another shift
      // After shifting to A0 with char 5 (from A1), all chars should be from A0
      expect(result).toBe('helloRSWCbhi');
    });

    it('should handle single-character shifts with Z-char 2', () => {
      // From A0 -> A1: 'h' (A0) + shift to A1 (2) + 'A' (A1) + 'i' (A0)
      let zString = [13, 2, 6, 14];
      let result = decodeZString(mockMemory as unknown as Memory, zString);
      expect(result).toBe('hAi');

      // From A1 -> A2: shift lock to A1 (4) + 'A' (A1) + shift to A2 (2) + '\n' (A2) + 'B' (A1)
      zString = [4, 6, 2, 7, 7];
      result = decodeZString(mockMemory as unknown as Memory, zString);
      expect(result).toBe('A\nB');

      // From A2 -> A0: shift lock to A2 (5) + '\n' (A2) + shift to A0 (2) + 'a' (A0) + '5' (A2)
      zString = [5, 7, 2, 6, 13];
      result = decodeZString(mockMemory as unknown as Memory, zString);
      expect(result).toBe('\na5');
    });

    it('should handle single-character shifts with Z-char 3', () => {
      // From A0 -> A2: 'h' (A0) + shift to A2 (3) + '\n' (A2) + 'i' (A0)
      let zString = [13, 3, 7, 14];
      let result = decodeZString(mockMemory as unknown as Memory, zString);
      expect(result).toBe('h\ni');

      // From A1 -> A0: shift lock to A1 (4) + 'A' (A1) + shift to A0 (3) + 'a' (A0) + 'B' (A1)
      zString = [4, 6, 3, 6, 7];
      result = decodeZString(mockMemory as unknown as Memory, zString);
      expect(result).toBe('AaB');

      // From A2 -> A1: shift lock to A2 (5) + '\n' (A2) + shift to A1 (3) + 'A' (A1) + '5' (A2)
      zString = [5, 7, 3, 6, 13];
      result = decodeZString(mockMemory as unknown as Memory, zString);
      expect(result).toBe('\nA5');
    });

    it('should maintain shift lock until single-character shift is used', () => {
      // Shift lock to A1 (4) + 'ABC' (A1) + single shift to A0 (3) + 'a' (A0) + 'DEF' (A1)
      const zString = [4, 6, 7, 8, 3, 6, 9, 10, 11];
      const result = decodeZString(mockMemory as unknown as Memory, zString);
      expect(result).toBe('ABCaDEF');
    });

    it('should allow shifting between all three alphabets in sequence', () => {
      // A complex sequence using all shift mechanisms:
      // 'a' (A0) + shift lock to A1 (4) + 'B' (A1) + single shift to A2 (2) + '\n' (A2) +
      // 'C' (A1) + single shift to A0 (3) + 'b' (A0) + 'D' (A1) + shift lock to A0 (5) +
      // 'hij' (A0) + single shift to A1 (2) + 'K' (A1) + 'k' (A0)
      const zString = [6, 4, 7, 2, 7, 8, 3, 7, 9, 5, 13, 14, 15, 2, 16, 16];
      const result = decodeZString(mockMemory as unknown as Memory, zString);
      expect(result).toBe('aB\nCbDhijKk');
    });

    it('should handle combinations of single shifts and shift locks', () => {
      // Start in A0, use single shifts and locks in combination
      // 'hi' (A0) + single shift to A1 (2) + 'A' (A1) + 'j' (A0) +
      // shift lock to A1 (4) + 'BC' (A1) + single shift to A2 (2) + '\n' (A2) +
      // 'D' (A1) + shift lock to A0 (5) + 'hij' (A0) + single shift to A1 (2) + 'K' (A1) + 'k' (A0)
      const zString = [13, 14, 2, 6, 15, 4, 7, 8, 2, 7, 9, 5, 13, 14, 15, 2, 16, 16];
      const result = decodeZString(mockMemory as unknown as Memory, zString);
      expect(result).toBe('hiAjBC\nDhijKk');
    });
  });
  // Test suite for Version 1 Z-character 1 handling
  describe('Version 1 specific behavior', () => {
    beforeEach(() => {
      mockMemory.getByte.mockImplementation((addr: number) => {
        if (addr === HeaderLocation.Version) return 1;
        return 0;
      });
    });

    it('should handle Z-character 1 as newline in Version 1', () => {
      const zString = [1]; // Z-character 1 in Version 1
      const result = decodeZString(mockMemory as unknown as Memory, zString);
      expect(result).toBe('\n'); // Should be decoded as newline
    });

    it('should not interpret Z-character 1 as abbreviation in Version 1', () => {
      // Mock abbreviation table and string
      mockMemory.getWord.mockImplementation((addr: number) => {
        if (addr === HeaderLocation.AbbreviationsTable) return 0x1000;
        if (addr === 0x1000) return 0x0800; // This would be an abbreviation in V2+
        return 0;
      });

      const zString = [1, 5]; // Z-character 1 followed by index 5
      const result = decodeZString(mockMemory as unknown as Memory, zString);

      // Should be decoded as newline followed by whatever character 5 maps to
      // NOT as an abbreviation
      expect(result).not.toBe('the '); // This would be the abbreviation in V2+
      expect(result.startsWith('\n')).toBe(true);
    });
  });

  // Test suite for Version 2 abbreviation handling
  describe('Version 2 specific behavior', () => {
    beforeEach(() => {
      mockMemory.getByte.mockImplementation((addr: number) => {
        if (addr === HeaderLocation.Version) return 2;
        return 0;
      });
    });

    it('should handle Z-character 1 as abbreviation in Version 2', () => {
      // Mock abbreviation table and string
      mockMemory.getWord.mockImplementation((addr: number) => {
        if (addr === HeaderLocation.AbbreviationsTable) return 0x1000;
        if (addr === 0x1000 + 5 * 2) return 0x0800; // Abbreviation entry
        return 0;
      });

      // Mock the getZString result for the abbreviation
      mockMemory.getZString.mockImplementation((addr: number) => {
        if (addr === 0x1000) return [25, 13, 10, 0]; // "the "
        return [];
      });

      const zString = [1, 5]; // Z-character 1 followed by index 5
      const result = decodeZString(mockMemory as unknown as Memory, zString);

      expect(result).toBe('the '); // Assuming abbreviation 5 is "the "
    });

    it('should handle abbreviation table validation in Version 2', () => {
      // Mock invalid abbreviation table address
      mockMemory.getWord.mockImplementation((addr: number) => {
        if (addr === HeaderLocation.AbbreviationsTable) return 0;
        return 0;
      });

      const zString = [1, 5]; // Z-character 1 followed by index 5
      const result = decodeZString(mockMemory as unknown as Memory, zString);

      // Should gracefully handle invalid abbreviation table
      expect(result).toBe('?');
    });
  });
});
