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
  const version = memory.getByte(HeaderLocation.Version);

  // Use version-specific decoder
  if (version <= 2) {
    // Version 2 only supports z-character 1 as abbreviation
    return decodeZStringV1V2(memory, zStr, expandAbbreviations, version);
  } else {
    // Version 3+ supports z-characters 1, 2, and 3 as abbreviations
    return decodeZStringV3Plus(memory, zStr, expandAbbreviations);
  }
}

/**
 * Decodes a Z-string for Z-Machine version 2
 * This versions shares distinct shift behavior with shift and shift-lock characters with v1 and
 * supports a single abbreviation set via z-character 1.
 */
function decodeZStringV1V2(memory: Memory, zStr: ZString, expandAbbreviations: boolean, version: number): string {
  let currentAlphabet = 0; // Current alphabet (0=A0, 1=A1, 2=A2)
  let lockedAlphabet = 0; // Locked alphabet
  const result: string[] = [];
  let isTemporaryShift = false; // Track if the current character uses a temporary shift

  // Get alphabet table
  const alphabetTables = memory.getAlphabetTables();

  for (let i = 0; i < zStr.length; i++) {
    const zChar = zStr[i];

    if (zChar === 0) {
      // Space
      result.push(' ');
    } else if (zChar === 1) {
      // Handle Z-character 1 based on version
      i = handleZChar1ForV1V2(memory, zStr, i, result, expandAbbreviations, version);
    } else if (zChar === 2) {
      // Shift character 2 - for next character only
      isTemporaryShift = true;
      if (currentAlphabet === 0)
        currentAlphabet = 1; // A0 -> A1
      else if (currentAlphabet === 1)
        currentAlphabet = 2; // A1 -> A2
      else currentAlphabet = 0; // A2 -> A0
    } else if (zChar === 3) {
      // Shift character 3 - for next character only
      isTemporaryShift = true;
      if (currentAlphabet === 0)
        currentAlphabet = 2; // A0 -> A2
      else if (currentAlphabet === 1)
        currentAlphabet = 0; // A1 -> A0
      else currentAlphabet = 1; // A2 -> A1
    } else if (zChar === 4) {
      // Shift lock character 4 - permanent until changed
      if (currentAlphabet === 0)
        currentAlphabet = 1; // A0 -> A1
      else if (currentAlphabet === 1)
        currentAlphabet = 2; // A1 -> A2
      else currentAlphabet = 0; // A2 -> A0
      lockedAlphabet = currentAlphabet;
      isTemporaryShift = false;
    } else if (zChar === 5) {
      // Shift lock character 5 - permanent until changed
      if (currentAlphabet === 0)
        currentAlphabet = 2; // A0 -> A2
      else if (currentAlphabet === 1)
        currentAlphabet = 0; // A1 -> A0
      else currentAlphabet = 1; // A2 -> A1
      lockedAlphabet = currentAlphabet;
      isTemporaryShift = false;
    } else if (currentAlphabet === 2 && zChar === 6) {
      // ZSCII escape sequence - not fully implemented in V1-2 but handle as best we can
      if (i + 2 < zStr.length) {
        const topBits = zStr[++i];
        const bottomBits = zStr[++i];
        const zsciiCode = (topBits << 5) | bottomBits;
        result.push(String.fromCharCode(zsciiCode));
        currentAlphabet = 0; // Return to A0
      } else {
        result.push('?');
      }
    } else if (currentAlphabet === 2 && zChar === 7) {
      // Newline
      result.push('\n');

      // If this was a temporary shift, return to locked alphabet
      if (isTemporaryShift) {
        currentAlphabet = lockedAlphabet;
        isTemporaryShift = false;
      }
    } else {
      // Regular character
      const charIndex = zChar - 6;

      if (charIndex >= 0 && charIndex < alphabetTables[currentAlphabet].length) {
        // Get the actual character from the correct alphabet table
        const actualChar = alphabetTables[currentAlphabet][charIndex];
        result.push(actualChar);
      } else {
        result.push('?');
      }

      // If this was a temporary shift, return to locked alphabet
      if (isTemporaryShift) {
        currentAlphabet = lockedAlphabet;
        isTemporaryShift = false;
      }
    }
  }

  return result.join('');
}

function handleZChar1ForV1V2(
  memory: Memory,
  zStr: Array<number>,
  index: number,
  result: string[],
  expandAbbreviations: boolean,
  version: number
): number {
  if (version === 1) {
    // In Version 1, Z-character 1 is a newline
    result.push('\n');
    return index; // No change to index
  } else {
    // version === 2
    // In Version 2, Z-character 1 is an abbreviation marker
    if (expandAbbreviations && index + 1 < zStr.length) {
      const nextChar = zStr[index + 1];
      const abbrevIndex = nextChar;
      const abbrevTableAddr = memory.getWord(HeaderLocation.AbbreviationsTable);

      // Add validation here
      if (abbrevTableAddr === 0 || !memory.isDynamicMemory(abbrevTableAddr)) {
        result.push('?'); // Invalid table address
        return index;
      }

      const entryAddr = abbrevTableAddr + abbrevIndex * 2;

      // Validate entry address
      if (!memory.isDynamicMemory(entryAddr + 1)) {
        result.push('?'); // Invalid entry address
        return index;
      }

      const abbrevAddr = memory.getWord(entryAddr) * 2;

      try {
        const abbrevText = decodeZString(memory, memory.getZString(abbrevAddr), false);
        result.push(abbrevText);
      } catch (e) {
        result.push('?'); // Error during abbreviation resolution
      }

      return index + 1; // Consume the next character
    }

    return index; // No change to index if not expanding or incomplete
  }
}

/**
 * Decodes a Z-string for Z-Machine versions 3 and up
 */
function decodeZStringV3Plus(memory: Memory, zStr: ZString, expandAbbreviations: boolean): string {
  let alphabet = 0; // Current alphabet (0=A0, 1=A1, 2=A2)
  const result: string[] = [];
  let unicodeMode = false;
  const unicodeHigh = 0;

  // Get version-specific information
  const version = memory.getByte(HeaderLocation.Version);
  const alphabetTables = memory.getAlphabetTables();

  for (let i = 0; i < zStr.length; i++) {
    const zChar = zStr[i];

    if (zChar <= 5) {
      switch (zChar) {
        case 0: // Space
          result.push(' ');
          break;

        case 1: // Abbreviation
        case 2: // Abbreviation
        case 3: // Abbreviation
          if (expandAbbreviations) {
            const nextChar = zStr[++i];
            const abbrevIndex = 32 * (zChar - 1) + nextChar;
            const abbrevTableAddr = memory.getWord(HeaderLocation.AbbreviationsTable);
            const abbrevAddr = memory.getWord(abbrevTableAddr + abbrevIndex * 2) * 2;

            const abbrevText = decodeZString(memory, memory.getZString(abbrevAddr), false);
            result.push(abbrevText);
          }
          break;

        case 4: // Shift to A1 (temporary)
          alphabet = 1;
          break;

        case 5: // Shift to A2 (temporary)
          alphabet = 2;
          break;
      }
    } else if (unicodeMode) {
      // Handle Unicode sequence
      const lowBits = zChar;
      const unicodeChar = (unicodeHigh << 5) | lowBits;

      if (version >= 5) {
        result.push(String.fromCodePoint(memory.zsciiToUnicode(unicodeChar)));
      } else {
        result.push(String.fromCodePoint(unicodeChar));
      }

      unicodeMode = false;
      alphabet = 0; // Always return to A0 after unicode in V3+
    } else if (alphabet === 2 && zChar === 6) {
      // Handle ZSCII escape sequence
      if (i + 2 < zStr.length) {
        const topBits = zStr[++i];
        const bottomBits = zStr[++i];
        const zsciiCode = (topBits << 5) | bottomBits;
        result.push(String.fromCharCode(zsciiCode));
        alphabet = 0; // Return to A0
      } else {
        result.push('?');
      }
    } else if (alphabet === 2 && zChar === 7) {
      // Newline
      result.push('\n');
      alphabet = 0; // Always return to A0 after newline in V3+
    } else {
      // Regular character
      const alphabetIndex = zChar - 6;

      if (alphabetIndex >= 0 && alphabetIndex < alphabetTables[alphabet].length) {
        result.push(alphabetTables[alphabet][alphabetIndex]);
      } else {
        result.push('?');
      }

      // In V3+, always return to A0 after shift
      if (alphabet !== 0) {
        alphabet = 0;
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
export function packZCharacters(zChars: number[], version: number, padding: number = 0x05): number[] {
  const resolution = version > 3 ? 3 : 2;
  const words: number[] = [];

  // Calculate how many words we actually need based on the input length
  // (rounded up to the nearest triplet)
  const neededWords = Math.ceil(zChars.length / 3);
  const actualResolution = Math.min(neededWords, resolution);

  // Pack 3 Z-characters into each word
  for (let i = 0; i < actualResolution; i++) {
    const index = i * 3;
    const char1 = index < zChars.length ? zChars[index] : padding;
    const char2 = index + 1 < zChars.length ? zChars[index + 1] : padding;
    const char3 = index + 2 < zChars.length ? zChars[index + 2] : padding;

    // Pack the characters into a 16-bit word
    let word = (char1 << 10) | (char2 << 5) | char3;

    // Set terminator bit on last word
    if (i === actualResolution - 1) {
      word |= 0x8000;
    }

    words.push(word);
  }

  return words;
}
