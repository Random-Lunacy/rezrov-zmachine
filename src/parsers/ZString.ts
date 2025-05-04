import { Memory } from '../core/memory/Memory';
import { ZSCII } from '../types';
import { HeaderLocation } from '../utils/constants';

/**
 * Represents a Z-string as an array of Z-characters
 */
export type ZString = Array<ZSCII>;

/**
 * Decodes a Z-string into a readable string
 *
 * @param memory The Memory object to read from
 * @param zStr The Z-string to decode
 * @param expandAbbreviations Whether to expand abbreviations
 * @returns The decoded string
 */
export function decodeZString(memory: Memory, zStr: ZString, expandAbbreviations: boolean = true): string {
  let alphabet = 0;
  const result: string[] = [];
  let unicodeMode = false;
  let unicodeHigh = 0;

  // Get alphabet table (either custom or default)
  const version = memory.getByte(HeaderLocation.Version);
  const alphabetTables = memory.getAlphabetTables();

  for (let i = 0; i < zStr.length; i++) {
    const zChar = zStr[i];

    if (zChar <= 5) {
      switch (zChar) {
        case 0:
          result.push(' ');
          break;

        case 1:
        case 2:
        case 3:
          if (expandAbbreviations && version >= 3) {
            const nextChar = zStr[++i];
            const abbrevIndex = 32 * (zChar - 1) + nextChar;
            const abbrevTableAddr = memory.getWord(HeaderLocation.AbbreviationsTable);
            const abbrevAddr = memory.getWord(abbrevTableAddr + abbrevIndex * 2) * 2;

            const abbrevText = decodeZString(memory, memory.getZString(abbrevAddr), false);
            result.push(abbrevText);
          } else if (version <= 2) {
            // In V1-2, Z-characters 2 and 3 are temporary shift characters
            if (zChar === 2) {
              // Shift table: from A0->A1, from A1->A2, from A2->A0
              alphabet = alphabet === 0 ? 1 : alphabet === 1 ? 2 : 0;
            } else if (zChar === 3) {
              // Shift table: from A0->A2, from A1->A0, from A2->A1
              alphabet = alphabet === 0 ? 2 : alphabet === 1 ? 0 : 1;
            }
          }
          break;

        case 4:
          // Shift behavior depends on version
          if (version <= 2) {
            // In V1-2, shift lock to alphabet A1
            alphabet = 1;
          } else {
            // In V3+, temporary shift to A1
            alphabet = 1;
          }
          break;

        case 5:
          // Shift behavior depends on version
          if (version <= 2) {
            // In V1-2, shift lock to alphabet A2
            alphabet = 2;
          } else {
            // In V3+, temporary shift to A2
            alphabet = 2;
          }
          break;
      }
    } else if (unicodeMode) {
      const lowBits = zStr[i];
      const unicodeChar = (unicodeHigh << 5) | lowBits;

      if (version >= 5) {
        result.push(String.fromCodePoint(memory.zsciiToUnicode(unicodeChar)));
      } else {
        result.push(String.fromCodePoint(unicodeChar));
      }

      unicodeMode = false;
      alphabet = 0;
    } else if (alphabet === 2 && zChar === 6 && version >= 5) {
      // ZSCII escape sequence (Unicode)
      if (i + 2 < zStr.length) {
        unicodeMode = true;
        unicodeHigh = zStr[++i];
        continue;
      } else {
        result.push('?');
        break;
      }
    } else if (alphabet === 2 && zChar === 7) {
      // Newline
      result.push('\n');

      // Reset shift after newline in V3+
      if (version > 2) {
        alphabet = 0;
      }
    } else {
      const alphabetIndex = zChar - 6;

      if (alphabetIndex >= 0 && alphabetIndex < alphabetTables[alphabet].length) {
        result.push(alphabetTables[alphabet][alphabetIndex]);
      } else {
        result.push('?');
      }

      // Reset shift only if we're in V3+ (temporary shifts)
      if (version > 2) {
        alphabet = 0;
      }
      // For V1-2, we maintain the current alphabet until another shift character is encountered
    }
  }

  return result.join('');
}

/**
 * Encodes a string into Z-string format
 *
 * @param text The string to encode
 * @param version Z-machine version (affects encoding)
 * @param padding Padding value for incomplete Z-strings
 * @returns Encoded Z-string
 */
export function encodeZString(memory: Memory, text: string, version: number, padding: number = 0x05): ZString {
  const resolution = version > 3 ? 3 : 2;
  text = text.slice(0, resolution * 3).toLowerCase();
  const zChars: Array<number> = [];

  // Get alphabet tables (should be accessible from a central place)
  const alphabetTables = memory.getAlphabetTables();

  for (const char of text) {
    // Try alphabet A0 (lowercase letters)
    const a0Index = alphabetTables[0].indexOf(char);
    if (a0Index >= 0) {
      zChars.push(a0Index + 6);
      continue;
    }

    // Try alphabet A1 (uppercase letters)
    const a1Index = alphabetTables[1].indexOf(char);
    if (a1Index >= 0) {
      zChars.push(4); // Shift to A1
      zChars.push(a1Index + 6);
      continue;
    }

    // Try alphabet A2 (punctuation/digits)
    const a2Index = alphabetTables[2].indexOf(char);
    if (a2Index >= 0) {
      zChars.push(5); // Shift to A2
      zChars.push(a2Index + 6);
      continue;
    }

    // Special case for newline
    if (char === '\n') {
      zChars.push(5); // Shift to A2
      zChars.push(7); // Newline in A2
      continue;
    }

    // Fall back to ZSCII escape sequence for other characters
    const charCode = char.charCodeAt(0);
    if (charCode >= 32 && charCode <= 126) {
      zChars.push(5); // Shift to A2
      zChars.push(6); // ZSCII escape
      zChars.push((charCode >> 5) & 0x1f);
      zChars.push(charCode & 0x1f);
    } else {
      // Use padding for unsupported characters
      zChars.push(padding);
    }
  }

  // Pad to full resolution length
  while (zChars.length < resolution * 3) {
    zChars.push(padding);
  }

  return zChars;
}

/**
 * Packs a series of Z-characters into Z-machine words
 *
 * @param zChars Z-characters to pack
 * @param version Z-machine version (affects encoding)
 * @returns Packed words
 */
export function packZCharacters(zChars: number[], version: number): number[] {
  const resolution = version > 3 ? 3 : 2;
  const words: number[] = [];

  // Pack 3 Z-characters into each word
  for (let i = 0; i < resolution; i++) {
    const index = i * 3;

    if (index < zChars.length) {
      const char1 = zChars[index];
      const char2 = index + 1 < zChars.length ? zChars[index + 1] : 5; // Padding
      const char3 = index + 2 < zChars.length ? zChars[index + 2] : 5; // Padding

      // Pack the characters into a 16-bit word
      let word = (char1 << 10) | (char2 << 5) | char3;

      // Set terminator bit on last word
      if (i === resolution - 1) {
        word |= 0x8000;
      }

      words.push(word);
    }
  }

  return words;
}
