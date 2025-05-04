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
  let alphabet = 0; // Current alphabet (0=A0, 1=A1, 2=A2)
  let lockedAlphabet = 0; // Locked alphabet for V1-2 (used after temporary shifts)
  const result: string[] = [];
  let unicodeMode = false;
  let unicodeHigh = 0;
  let tempShift = false; // Track if current shift is temporary

  // Get alphabet table (either custom or default)
  const version = memory.getByte(HeaderLocation.Version);
  const alphabetTables = memory.getAlphabetTables();

  for (let i = 0; i < zStr.length; i++) {
    const zChar = zStr[i];

    if (zChar <= 5) {
      switch (zChar) {
        case 0: // Space
          result.push(' ');
          break;

        case 1: // Abbreviation 1
          if (expandAbbreviations) {
            const nextChar = zStr[++i];
            const abbrevIndex = 32 * (zChar - 1) + nextChar;
            const abbrevTableAddr = memory.getWord(HeaderLocation.AbbreviationsTable);
            const abbrevAddr = memory.getWord(abbrevTableAddr + abbrevIndex * 2) * 2;

            const abbrevText = decodeZString(memory, memory.getZString(abbrevAddr), false);
            result.push(abbrevText);
          }
          break;

        case 2: // Shift or abbreviation
          if (version <= 2) {
            // V1-2 shift behavior
            tempShift = true;
            if (alphabet === 0)
              alphabet = 1; // A0 -> A1
            else if (alphabet === 1)
              alphabet = 2; // A1 -> A2
            else alphabet = 0; // A2 -> A0
          } else if (expandAbbreviations) {
            // V3+ abbreviation
            const nextChar = zStr[++i];
            const abbrevIndex = 32 * (zChar - 1) + nextChar;
            const abbrevTableAddr = memory.getWord(HeaderLocation.AbbreviationsTable);
            const abbrevAddr = memory.getWord(abbrevTableAddr + abbrevIndex * 2) * 2;

            const abbrevText = decodeZString(memory, memory.getZString(abbrevAddr), false);
            result.push(abbrevText);
          }
          break;

        case 3: // Shift or abbreviation
          if (version <= 2) {
            // V1-2 shift behavior
            tempShift = true;
            if (alphabet === 0)
              alphabet = 2; // A0 -> A2
            else if (alphabet === 1)
              alphabet = 0; // A1 -> A0
            else alphabet = 1; // A2 -> A1
          } else if (expandAbbreviations) {
            // V3+ abbreviation
            const nextChar = zStr[++i];
            const abbrevIndex = 32 * (zChar - 1) + nextChar;
            const abbrevTableAddr = memory.getWord(HeaderLocation.AbbreviationsTable);
            const abbrevAddr = memory.getWord(abbrevTableAddr + abbrevIndex * 2) * 2;

            const abbrevText = decodeZString(memory, memory.getZString(abbrevAddr), false);
            result.push(abbrevText);
          }
          break;

        case 4: // Shift lock or shift
          if (version <= 2) {
            // V1-2 shift lock behavior
            tempShift = false;
            if (alphabet === 0) {
              alphabet = 1; // A0 -> A1
              lockedAlphabet = 1; // Lock to A1
            } else if (alphabet === 1) {
              alphabet = 2; // A1 -> A2
              lockedAlphabet = 2; // Lock to A2
            } else {
              alphabet = 0; // A2 -> A0
              lockedAlphabet = 0; // Lock to A0
            }
          } else {
            // V3+ shift behavior
            alphabet = 1;
            tempShift = true;
          }
          break;

        case 5: // Shift lock or shift
          if (version <= 2) {
            // V1-2 shift lock behavior
            tempShift = false;
            if (alphabet === 0) {
              alphabet = 2; // A0 -> A2
              lockedAlphabet = 2; // Lock to A2
            } else if (alphabet === 1) {
              alphabet = 0; // A1 -> A0
              lockedAlphabet = 0; // Lock to A0
            } else {
              alphabet = 1; // A2 -> A1
              lockedAlphabet = 1; // Lock to A1
            }
          } else {
            // V3+ shift behavior
            alphabet = 2;
            tempShift = true;
          }
          break;
      }
    } else if (unicodeMode) {
      // Handle ZSCII escape sequence
      const lowBits = zChar;
      const unicodeChar = (unicodeHigh << 5) | lowBits;

      if (version >= 5) {
        result.push(String.fromCodePoint(memory.zsciiToUnicode(unicodeChar)));
      } else {
        result.push(String.fromCodePoint(unicodeChar));
      }

      unicodeMode = false;

      // Return to appropriate alphabet after Unicode
      if (version <= 2) {
        alphabet = lockedAlphabet;
      } else {
        alphabet = 0;
      }
    } else if (alphabet === 2 && zChar === 6 && version >= 5) {
      // ZSCII escape sequence (V5+)
      if (i + 2 < zStr.length) {
        // Check for TWO more characters
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

      // V3+ reset after newline
      if (version > 2) {
        alphabet = 0;
      }
    } else {
      // Regular character
      const alphabetIndex = zChar - 6;

      if (alphabetIndex >= 0 && alphabetIndex < alphabetTables[alphabet].length) {
        result.push(alphabetTables[alphabet][alphabetIndex]);
      } else {
        result.push('?');
      }

      // Handle shift reset
      if (tempShift) {
        if (version <= 2) {
          // In V1-2, return to locked alphabet
          alphabet = lockedAlphabet;
        } else {
          // In V3+, always return to A0
          alphabet = 0;
        }
        tempShift = false;
      }
    }
  }

  return result.join('');
}

/**
 * Encodes a string into Z-string format for dictionary lookup
 *
 * @param memory The Memory object to access alphabet tables
 * @param text The string to encode
 * @param version Z-machine version (affects encoding length)
 * @param padding Padding value for incomplete Z-strings (default 0x05)
 * @param separators Optional array of word separator characters
 * @returns Encoded Z-string
 */
export function encodeZString(
  memory: Memory,
  text: string,
  version: number,
  padding: number = 0x05,
  separators: string[] = ['.', ',', '"']
): ZString {
  const resolution = version > 3 ? 3 : 2;
  const maxZChars = resolution * 3;
  const zChars: Array<number> = [];

  // For dictionary lookups, convert to lowercase per spec
  text = text.toLowerCase();

  // Check if the input is a single word separator character
  if (text.length === 1 && separators.includes(text)) {
    // Encode the separator as its own dictionary word
    const a2Index = memory.getAlphabetTables()[2].indexOf(text);
    if (a2Index >= 0) {
      zChars.push(5); // Shift to A2
      zChars.push(a2Index + 6);
    }
  } else {
    // Process as a regular word
    // First, check if there are any word separators in the text
    let wordEnd = text.length;
    for (const separator of separators) {
      const sepIndex = text.indexOf(separator);
      if (sepIndex !== -1 && sepIndex < wordEnd) {
        wordEnd = sepIndex;
      }
    }

    // Also check for spaces (which are word dividers but not words themselves)
    const spaceIndex = text.indexOf(' ');
    if (spaceIndex !== -1 && spaceIndex < wordEnd) {
      wordEnd = spaceIndex;
    }

    // Also check for new line (which is a word divider but not a word itself)
    const newLineIndex = text.indexOf('\n');
    if (newLineIndex !== -1 && newLineIndex < wordEnd) {
      wordEnd = newLineIndex;
    }

    // Get just the first word
    const word = text.substring(0, wordEnd);

    // Get alphabet tables
    const alphabetTables = memory.getAlphabetTables();

    // Encode each character of the word
    for (const char of word) {
      // Since the text is already lowercased, we only need to check alphabet A0 for letters
      const a0Index = alphabetTables[0].indexOf(char);
      if (a0Index >= 0) {
        zChars.push(a0Index + 6);
        continue;
      }

      // Check A2 for punctuation/digits
      const a2Index = alphabetTables[2].indexOf(char);
      if (a2Index >= 0) {
        zChars.push(5); // Shift to A2
        zChars.push(a2Index + 6);
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
  }

  // Pad to exact resolution length
  while (zChars.length < maxZChars) {
    zChars.push(padding);
  }

  // If we've exceeded the resolution length (possible with shift codes), truncate
  if (zChars.length > maxZChars) {
    zChars.length = maxZChars;
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
