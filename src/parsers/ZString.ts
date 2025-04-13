// src/parsers/ZString.ts
import { Memory } from '../core/memory/Memory';
import { ZSCII } from '../types';
import { HeaderLocation } from '../utils/constants';

/**
 * Represents a Z-string as an array of Z-characters
 */
export type ZString = Array<ZSCII>;

/**
 * Default Z-machine alphabet tables
 */
const DEFAULT_ALPHABET_TABLES = [
  /* A0 */ 'abcdefghijklmnopqrstuvwxyz',
  /* A1 */ 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  /* A2 */ ' \n0123456789.,!?_#\'"/\\-:()',
];

/**
 * Decodes a Z-string into a readable string
 *
 * @param memory The Memory object to read from
 * @param zstr The Z-string to decode
 * @param expandAbbreviations Whether to expand abbreviations
 * @returns The decoded string
 */
export function decodeZString(memory: Memory, zstr: ZString, expandAbbreviations: boolean = true): string {
  // State variables
  let alphabet = 0; // Current alphabet (0, 1, or 2)
  let customAlphabetTable: string[] | null = null;
  const result: string[] = [];

  // Check if there's a custom alphabet table
  const alphabetTableAddr = memory.getWord(HeaderLocation.AlphabetTable);
  if (alphabetTableAddr !== 0) {
    // Load custom alphabet table (implementation would depend on format)
    // For now, we use the default
    customAlphabetTable = [...DEFAULT_ALPHABET_TABLES];
  }

  // Use appropriate alphabet table
  const alphabetTable = customAlphabetTable || DEFAULT_ALPHABET_TABLES;

  // Process each Z-character
  for (let i = 0; i < zstr.length; i++) {
    const zchar = zstr[i];

    // Handle special characters (0-5)
    if (zchar <= 5) {
      switch (zchar) {
        case 0: // Space
          result.push(' ');
          break;

        case 1:
        case 2:
        case 3: // Abbreviations
          if (expandAbbreviations) {
            const nextChar = zstr[++i];
            const abbrevIndex = 32 * (zchar - 1) + nextChar;
            const abbrevTableAddr = memory.getWord(HeaderLocation.AbbreviationsTable);
            const abbrevAddr = memory.getWord(abbrevTableAddr + abbrevIndex * 2) * 2;

            // Recursively decode the abbreviation
            // We set expandAbbreviations to false to prevent infinite recursion
            const abbrevText = decodeZString(memory, memory.getZString(abbrevAddr), false);
            result.push(abbrevText);
          }
          break;

        case 4: // Shift to A1 (upper case)
          alphabet = 1;
          break;

        case 5: // Shift to A2 (symbols)
          alphabet = 2;
          break;
      }
    }
    // Handle special case: character 6 from A2 indicates ZSCII encoding
    else if (zchar === 6 && alphabet === 2) {
      // Next two Z-characters specify a ten-bit ZSCII character code
      const zchar1 = zstr[++i];
      const zchar2 = zstr[++i];

      const zsciiCode = (zchar1 << 5) | zchar2;
      result.push(String.fromCharCode(zsciiCode));

      // Reset to alphabet 0
      alphabet = 0;
    }
    // Handle regular characters
    else {
      // Get character from current alphabet
      const alphabetIndex = zchar - 6;

      if (alphabetIndex >= 0 && alphabetIndex < alphabetTable[alphabet].length) {
        result.push(alphabetTable[alphabet][alphabetIndex]);
      } else {
        // Invalid character index
        result.push('?');
      }

      // Reset to alphabet 0 after a character from alphabet 1 or 2
      if (alphabet > 0) {
        alphabet = 0;
      }
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
export function encodeZString(text: string, version: number, padding: number = 0x05): ZString {
  // Determine resolution based on version
  const resolution = version > 3 ? 3 : 2;

  // Convert text to lowercase for encoding
  text = text.slice(0, resolution * 3).toLowerCase();
  const zchars: Array<number> = [];

  // Encode each character
  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // Try to encode as lowercase letter (alphabet 0)
    if (char >= 'a' && char <= 'z') {
      zchars.push(char.charCodeAt(0) - 'a'.charCodeAt(0) + 6);
    }
    // Try to encode as uppercase letter (alphabet 1)
    else if (char >= 'A' && char <= 'Z') {
      zchars.push(4); // Shift to A1
      zchars.push(char.charCodeAt(0) - 'A'.charCodeAt(0) + 6);
    }
    // Try to encode as symbol or number (alphabet 2)
    else {
      const a2Index = DEFAULT_ALPHABET_TABLES[2].indexOf(char);

      if (a2Index >= 0) {
        zchars.push(5); // Shift to A2
        zchars.push(a2Index + 6);
      }
      // Handle special characters with ZSCII encoding
      else {
        const charCode = char.charCodeAt(0);

        // Only handle printable ASCII
        if (charCode >= 32 && charCode <= 126) {
          zchars.push(5); // Shift to A2
          zchars.push(6); // ZSCII escape
          zchars.push((charCode >> 5) & 0x1f); // Upper 5 bits
          zchars.push(charCode & 0x1f); // Lower 5 bits
        } else {
          // Use padding for non-encodable characters
          zchars.push(padding);
        }
      }
    }
  }

  // Pad to required length
  while (zchars.length < resolution * 3) {
    zchars.push(padding);
  }

  return zchars;
}

/**
 * Packs a series of Z-characters into Z-machine words
 *
 * @param zchars Z-characters to pack
 * @param version Z-machine version (affects encoding)
 * @returns Packed words
 */
export function packZCharacters(zchars: number[], version: number): number[] {
  const resolution = version > 3 ? 3 : 2;
  const words: number[] = [];

  // Pack 3 Z-characters into each word
  for (let i = 0; i < resolution; i++) {
    const index = i * 3;

    if (index < zchars.length) {
      const char1 = zchars[index];
      const char2 = index + 1 < zchars.length ? zchars[index + 1] : 5; // Padding
      const char3 = index + 2 < zchars.length ? zchars[index + 2] : 5; // Padding

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

/**
 * Unpacks a routine address according to Z-machine version rules
 *
 * @param memory Memory object
 * @param packedAddr Packed address
 * @returns Unpacked memory address
 */
export function unpackRoutineAddress(memory: Memory, packedAddr: number): number {
  const version = memory.getByte(HeaderLocation.Version);
  const routinesOffset = version >= 6 && version <= 7 ? memory.getWord(HeaderLocation.RoutinesOffset) : 0;

  if (version <= 3) {
    return packedAddr * 2;
  } else if (version <= 5) {
    return packedAddr * 4;
  } else if (version <= 7) {
    return packedAddr * 4 + routinesOffset;
  } else if (version === 8) {
    return packedAddr * 8;
  } else {
    throw new Error(`Unknown Z-machine version: ${version}`);
  }
}

/**
 * Unpacks a string address according to Z-machine version rules
 *
 * @param memory Memory object
 * @param packedAddr Packed address
 * @returns Unpacked memory address
 */
export function unpackStringAddress(memory: Memory, packedAddr: number): number {
  const version = memory.getByte(HeaderLocation.Version);
  const stringsOffset = version >= 6 && version <= 7 ? memory.getWord(HeaderLocation.StaticStringsOffset) : 0;

  if (version <= 3) {
    return packedAddr * 2;
  } else if (version <= 5) {
    return packedAddr * 4;
  } else if (version <= 7) {
    return packedAddr * 4 + stringsOffset;
  } else if (version === 8) {
    return packedAddr * 8;
  } else {
    throw new Error(`Unknown Z-machine version: ${version}`);
  }
}
